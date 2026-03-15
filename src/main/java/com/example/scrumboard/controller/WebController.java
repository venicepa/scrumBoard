package com.example.scrumboard.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebController {

    @GetMapping(value = { "/ticket/new", "/ticket/{id:\\d+}" })
    public String index() {
        return "forward:/index.html";
    }
}
