// "use strict";

const React = require("react");
const ReactDOM = require("react-dom");
const when = require("when");
const client = require("./client");

const follow = require("./follow"); // function to hop multiple links by "rel"

const stompClient = require("./websocket-listener");

const root = "/api";

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { runs: [], attributes: [], page: 1, pageSize: 20, links: {} };
    this.updatePageSize = this.updatePageSize.bind(this);
    this.onCreate = this.onCreate.bind(this);
    this.onUpdate = this.onUpdate.bind(this);
    this.onDelete = this.onDelete.bind(this);
    this.onNavigate = this.onNavigate.bind(this);
    this.refreshCurrentPage = this.refreshCurrentPage.bind(this);
    this.refreshAndGoToLastPage = this.refreshAndGoToLastPage.bind(this);
  }

  loadFromServer(pageSize) {
    follow(client, root, [{ rel: "runs", params: { size: pageSize } }])
      .then((runCollection) => {
        return client({
          method: "GET",
          path: runCollection.entity._links.profile.href,
          headers: { Accept: "application/schema+json" },
        }).then((schema) => {
          this.schema = schema.entity;
          this.links = runCollection.entity._links;
          return runCollection;
        });
      })
      .then((runCollection) => {
        this.page = runCollection.entity.page;
        return runCollection.entity._embedded.runs.map((run) =>
          client({
            method: "GET",
            path: run._links.self.href,
          })
        );
      })
      .then((runPromises) => {
        return when.all(runPromises);
      })
      .done((runs) => {
        this.setState({
          page: this.page,
          runs: runs,
          attributes: Object.keys(this.schema.properties),
          pageSize: pageSize,
          links: this.links,
        });
      });
  }

  // tag::on-create[]
  onCreate(newRun) {
    follow(client, root, ["runs"]).done((response) => {
      client({
        method: "POST",
        path: response.entity._links.self.href,
        entity: newRun,
        headers: { "Content-Type": "application/json" },
      });
    });
  }
  // end::on-create[]

  onUpdate(run, updatedRun) {
    client({
      method: "PUT",
      path: run.entity._links.self.href,
      entity: updatedRun,
      headers: {
        "Content-Type": "application/json",
        "If-Match": run.headers.Etag,
      },
    }).done(
      (response) => {
        /* Let the websocket handler update the state */
      },
      (response) => {
        if (response.status.code === 412) {
          alert(
            "DENIED: Unable to update " +
              run.entity._links.self.href +
              ". Your copy is stale."
          );
        }
      }
    );
  }

  onDelete(run) {
    client({ method: "DELETE", path: run.entity._links.self.href });
  }

  onNavigate(navUri) {
    client({
      method: "GET",
      path: navUri,
    })
      .then((runCollection) => {
        this.links = runCollection.entity._links;
        this.page = runCollection.entity.page;

        return runCollection.entity._embedded.runs.map((run) =>
          client({
            method: "GET",
            path: run._links.self.href,
          })
        );
      })
      .then((runPromises) => {
        return when.all(runPromises);
      })
      .done((runs) => {
        this.setState({
          page: this.page,
          runs: runs,
          attributes: Object.keys(this.schema.properties),
          pageSize: this.state.pageSize,
          links: this.links,
        });
      });
  }

  updatePageSize(pageSize) {
    if (pageSize !== this.state.pageSize) {
      this.loadFromServer(pageSize);
    }
  }

  // tag::websocket-handlers[]
  refreshAndGoToLastPage(message) {
    follow(client, root, [
      {
        rel: "runs",
        params: { size: this.state.pageSize },
      },
    ]).done((response) => {
      if (response.entity._links.last !== undefined) {
        this.onNavigate(response.entity._links.last.href);
      } else {
        this.onNavigate(response.entity._links.self.href);
      }
    });
  }

  refreshCurrentPage(message) {
    follow(client, root, [
      {
        rel: "runs",
        params: {
          size: this.state.pageSize,
          //   page: this.state.page.number,
        },
      },
    ])
      .then((runCollection) => {
        this.links = runCollection.entity._links;
        this.page = runCollection.entity.page;

        return runCollection.entity._embedded.runs.map((run) => {
          return client({
            method: "GET",
            path: run._links.self.href,
          });
        });
      })
      .then((runPromises) => {
        return when.all(runPromises);
      })
      .then((runs) => {
        this.setState({
          page: this.page,
          runs: runs,
          attributes: Object.keys(this.schema.properties),
          pageSize: this.state.pageSize,
          links: this.links,
        });
      });
  }
  // end::websocket-handlers[]

  // tag::register-handlers[]
  componentDidMount() {
    this.loadFromServer(this.state.pageSize);
    stompClient.register([
      { route: "/topic/newRun", callback: this.refreshAndGoToLastPage },
      { route: "/topic/updateRun", callback: this.refreshCurrentPage },
      { route: "/topic/deleteRun", callback: this.refreshCurrentPage },
    ]);
  }
  // end::register-handlers[]

  render() {
    return (
      <div>
        <RunList
          page={this.state.page}
          runs={this.state.runs}
          links={this.state.links}
          pageSize={this.state.pageSize}
          attributes={this.state.attributes}
          onNavigate={this.onNavigate}
          onUpdate={this.onUpdate}
          onDelete={this.onDelete}
          updatePageSize={this.updatePageSize}
        />
        <CreateDialog
          attributes={this.state.attributes}
          onCreate={this.onCreate}
        />
      </div>
    );
  }
}

class CreateDialog extends React.Component {
  constructor(props) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleSubmit(e) {
    e.preventDefault();
    const newRun = {};
    this.props.attributes.forEach((attribute) => {
      newRun[attribute] = ReactDOM.findDOMNode(
        this.refs[attribute]
      ).value.trim();
    });
    this.props.onCreate(newRun);
    this.props.attributes.forEach((attribute) => {
      ReactDOM.findDOMNode(this.refs[attribute]).value = ""; // clear out the dialog's inputs
    });
    window.location = "#";
  }

  render() {
    const inputs = this.props.attributes.map((attribute) => (
      <p key={attribute}>
        <input
          type="text"
          placeholder={(
            attribute.charAt(0).toUpperCase() + attribute.slice(1)
          ).replace(/([a-z](?=[A-Z]))/g, "$1 ")}
          ref={attribute}
          className="field"
        />
      </p>
    ));
    return (
      <div className="row">
        <a href="#postNewRun">Post New Run</a>

        <div id="postNewRun" className="modalDialog">
          <div>
            <a href="#" title="Close" className="close">
              X
            </a>

            <h2>Post New Run</h2>

            <form>
              {inputs}
              <button onClick={this.handleSubmit}>Post</button>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

class UpdateDialog extends React.Component {
  constructor(props) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleSubmit(e) {
    e.preventDefault();
    const updatedRun = {};
    this.props.attributes.forEach((attribute) => {
      updatedRun[attribute] = ReactDOM.findDOMNode(
        this.refs[attribute]
      ).value.trim();
    });
    this.props.onUpdate(this.props.run, updatedRun);
    window.location = "#";
  }

  render() {
    const inputs = this.props.attributes.map((attribute) => (
      <p key={this.props.run.entity[attribute]}>
        <input
          type="text"
          placeholder={attribute}
          defaultValue={this.props.run.entity[attribute]}
          ref={attribute}
          className="field"
        />
      </p>
    ));

    const dialogId = "updateRun-" + this.props.run.entity._links.self.href;

    return (
      <div>
        <a href={"#" + dialogId}>Update</a>

        <div id={dialogId} className="modalDialog">
          <div>
            <a href="#" title="Close" className="close">
              X
            </a>

            <h2>Update a Run</h2>

            <form>
              {inputs}
              <button onClick={this.handleSubmit}>Update</button>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

class RunList extends React.Component {
  constructor(props) {
    super(props);
    this.props = props;
    this.handleNavFirst = this.handleNavFirst.bind(this);
    this.handleNavPrev = this.handleNavPrev.bind(this);
    this.handleNavNext = this.handleNavNext.bind(this);
    this.handleNavLast = this.handleNavLast.bind(this);
    this.handleInput = this.handleInput.bind(this);
  }

  handleInput(e) {
    e.preventDefault();
    const pageSize = ReactDOM.findDOMNode(this.refs.pageSize).value;
    if (/^[0-9]+$/.test(pageSize)) {
      this.props.updatePageSize(pageSize);
    } else {
      ReactDOM.findDOMNode(this.refs.pageSize).value = pageSize.substring(
        0,
        pageSize.length - 1
      );
    }
  }

  handleNavFirst(e) {
    e.preventDefault();
    this.props.onNavigate(this.props.links.first.href);
  }

  handleNavPrev(e) {
    e.preventDefault();
    this.props.onNavigate(this.props.links.prev.href);
  }

  handleNavNext(e) {
    e.preventDefault();
    this.props.onNavigate(this.props.links.next.href);
  }

  handleNavLast(e) {
    e.preventDefault();
    this.props.onNavigate(this.props.links.last.href);
  }

  render() {
    // const pageInfo = this.props.page.hasOwnProperty("number") ? (
    //   <h3>
    //     Runs - Page {this.props.page.number + 1} of {this.props.page.totalPages}
    //   </h3>
    // ) : null;
    const runs = this.props.runs.map((run) => (
      <Run
        key={run.entity._links.self.href}
        run={run}
        attributes={this.props.attributes}
        onUpdate={this.props.onUpdate}
        onDelete={this.props.onDelete}
      />
    ));

    const navLinks = [];
    if ("first" in this.props.links) {
      navLinks.push(
        <button key="first" onClick={this.handleNavFirst}>
          &lt;&lt;
        </button>
      );
    }
    if ("prev" in this.props.links) {
      navLinks.push(
        <button key="prev" onClick={this.handleNavPrev}>
          &lt;
        </button>
      );
    }
    if ("next" in this.props.links) {
      navLinks.push(
        <button key="next" onClick={this.handleNavNext}>
          &gt;
        </button>
      );
    }
    if ("last" in this.props.links) {
      navLinks.push(
        <button key="last" onClick={this.handleNavLast}>
          &gt;&gt;
        </button>
      );
    }

    return (
      <div>
        {/* {pageInfo} */}
        <table>
          <tbody>
            <tr>
              <th>Date</th>
              <th>Distance</th>
              <th>Time</th>
              <th></th>
              <th></th>
            </tr>
            {runs}
          </tbody>
        </table>
        <div>{navLinks}</div>
      </div>
    );
  }
}

class Run extends React.Component {
  constructor(props) {
    super(props);
    this.handleDelete = this.handleDelete.bind(this);
  }

  handleDelete() {
    this.props.onDelete(this.props.run);
  }

  render() {
    return (
      <tr>
        <td>{this.props.run.entity.date}</td>
        <td>{this.props.run.entity.distance}</td>
        <td>{this.props.run.entity.totalTime}</td>
        <td>
          <UpdateDialog
            run={this.props.run}
            attributes={this.props.attributes}
            onUpdate={this.props.onUpdate}
          />
        </td>
        <td>
          <button onClick={this.handleDelete}>Delete</button>
        </td>
      </tr>
    );
  }
}

ReactDOM.render(<App />, document.getElementById("react"));
