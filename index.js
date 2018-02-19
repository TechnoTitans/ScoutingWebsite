'use strict';
import express from "express";
const app = express();

const port = 80;

// todo make project structure conform to firebase static/dynamic dirs etc
// app.use(express.static(staticFolder));
app.listen(port);