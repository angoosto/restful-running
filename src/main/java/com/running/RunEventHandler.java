package com.running;

import static com.running.WebSocketConfiguration.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.rest.core.annotation.HandleAfterCreate;
import org.springframework.data.rest.core.annotation.HandleAfterDelete;
import org.springframework.data.rest.core.annotation.HandleAfterSave;
import org.springframework.data.rest.core.annotation.RepositoryEventHandler;
import org.springframework.hateoas.server.EntityLinks;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RepositoryEventHandler(Run.class)
public class RunEventHandler {
    
    private final SimpMessagingTemplate websocket;
    private final EntityLinks entityLinks;

    @Autowired
    public RunEventHandler(SimpMessagingTemplate websocket, EntityLinks entityLinks) {
        this.websocket = websocket;
        this.entityLinks = entityLinks;
    }

    @HandleAfterCreate
    public void newRun(Run run) {
        this.websocket.convertAndSend(MESSAGE_PREFIX + "/newRun", getPath(run));
    }

    @HandleAfterDelete
    public void deleteRun(Run run) {
        this.websocket.convertAndSend(MESSAGE_PREFIX + "/deleteRun", getPath(run));
    }

    @HandleAfterSave
    public void updateRun(Run run) {
        this.websocket.convertAndSend(MESSAGE_PREFIX + "/updateEmployee", getPath(run));
    }

    private String getPath(Run run) {
        return this.entityLinks.linkForItemResource(run.getClass(), run.getId()).toUri().getPath();
    }

}
