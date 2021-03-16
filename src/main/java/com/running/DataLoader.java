package com.running;

import java.time.LocalDate;
import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataLoader implements CommandLineRunner {
    
    private final RunRepo repo;

    @Autowired
    public DataLoader(RunRepo repo) {
        this.repo = repo;
    }

    @Override
    public void run(String... args) throws Exception {
        Run fivek = new Run(LocalDate.of(2021,2,9), 5.0, 23.45);
        Run tenk = new Run(LocalDate.of(2021,3,20), 10.0, 47.23);
        this.repo.saveAll(Arrays.asList(fivek,tenk));
    }
}