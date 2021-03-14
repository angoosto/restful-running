package com.running;

import java.time.LocalDate;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.Version;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;

@Data
@Entity
public class Run {

    @Id @GeneratedValue
    private Long id;
    private Double distance;
    private LocalDate date;
    private Double totalTime;
    private @Version @JsonIgnore Long version;

    private Run(){};

    public Run(LocalDate date, Double distance, Double totalTime) {
        this.date = date;
        this.distance = distance;
        this.totalTime = totalTime;
    }
}
