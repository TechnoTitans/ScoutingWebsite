'use strict';


// import * as firebase from "firebase";

var config = {
    apiKey: "AIzaSyAyrHz96bV4nR3SoyMsyPQ__MdOrYHdaEk",
    authDomain: "scouting-data.firebaseapp.com",
    databaseURL: "https://scouting-data.firebaseio.com/",
    storageBucket: "bucket.appspot.com"
};
firebase.initializeApp(config);
console.log('fb conslog', firebase);
var db = firebase.database();

var state = 'ga', eventCode = 'gai', year = 2018;
var allTeams = [];

var writeScoutingData = function(data) {
    db.ref('/data/' + data.teamNum).set(data);
    console.log('sent data for team' + data.teamName);
};

var getTeamByNumber = function(num) {
    num = num.toString();
    for (let team of allTeams) {
        if (team.team_number.toString() === num) {
            return team;
        }
    }
};

var createSelectMenu = function(div, onchange) {
    var chosen = null;
    var btns = div.querySelectorAll("ons-button");
    div.dataset.selected = "";
    for (let button of btns) {
        button.onclick = function() {
            this.classList.add("chosen");
            if (chosen) chosen.classList.remove("chosen");
            if (this != chosen) {
                chosen = this;
            } else {
                chosen = null;
            }
            div.dataset.selected = chosen ? chosen.dataset.select : "";
            if (onchange) onchange(chosen);
        };
    }
};

var createNumInput = function(container) {
    var inp = container.querySelector("ons-input");
    var plus = container.querySelector(".plus"), minus = container.querySelector(".minus");
    plus.onclick = function() {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) v = 0;
        inp.value = v + 1;
    };
    minus.onclick = function() {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) v = 0;
        inp.value = v - 1;
    };
};

document.addEventListener('init', function (event) {
    console.log("Init", event.target.id);
    var page = event.target;
    // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
    if (page.matches("#home")) {
        var page = event.target;
        var getTeams = function () {
            var randomPage = 1;
            return axios({
                method: 'get',
                url: `https://www.thebluealliance.com/api/v3/event/${year}${state}${eventCode}/teams/simple`,
                headers: {'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e'}
            }).then(function (response) {
                allTeams = response.data;
                return response.data;
            });
        };

        var teamClick = function () {
            var teamNumber = this.dataset.teamNum;
            document.getElementById("appNavigator").pushPage("team-scout.html", {data: {num: teamNumber}});
        };
        var createTeam = function (team) {
            var elem = ons.createElement(`
              <ons-list-item data-team-num="${team.team_number}">
              <div>
                ${team.nickname} - ${team.team_number}
                </div>
              </ons-list-item>
            `
            );
            elem.onclick = teamClick;
            return elem;
        };
        var fetchTeams = function () {
            getTeams().then(function(teams) {
                addTeams(teams, []);
                page.querySelector("#loading").style.display = "none";
            });
        };

        var addTeams = function(teams, query) {
            for (let team of teams) {
                if (query.every(term => team.nickname.toLowerCase().indexOf(term) !== -1
                        || team.team_number.toString().indexOf(term) !== -1)
                    || (query.join(" ")==="the best team" && team.team_number === 1683)) { // lol easter egg
                    page.querySelector("#teams-list").appendChild(createTeam(team));
                }
            }
        };
        fetchTeams();
        // pullHook.onaction = fetchTeams;

        var searchBar = page.querySelector("ons-search-input");
        searchBar.onkeyup = function() {
            page.querySelector("#teams-list").innerHTML = "";
            var terms = this.value.toLowerCase().split(" ");
            addTeams(allTeams, terms);
        };
    } else if (page.matches("#team-scout")) {
        console.log(page.data);
        var teamNum = page.data.num;
        var teamObj = getTeamByNumber(teamNum);
        if (!teamObj) {
            alert("Could not find team"); // should never happen anyway
            return;
        }
        page.querySelector("#team-title").innerHTML = `${teamObj.nickname}`;
        var buttons = page.querySelectorAll("ons-card");
        for (let button of buttons) {
            button.onclick = function() {
                document.getElementById("appNavigator").pushPage(`${this.id}-scout.html`, {data: {team: teamObj}});
            }
        }
    } else if (page.matches("#match-scout")) {
        var team = document.querySelector("#match-scout").data.team;
        page.querySelector("#team-num").innerHTML = team.team_number;
        page.querySelector("#team-name").innerHTML = team.nickname;
        // autonomous
        var team = document.querySelector("#match-scout").data.team;
        console.log(team);
        //page.querySelector("#team-title").innerHTML = team.nickname;
        var target = -1, success = false, chosen = null;
        var targetBtns = page.querySelectorAll("#auto-target ons-button");
        var resultBtns = page.querySelectorAll("#auto-target-result ons-button");
        var enableButtons = function(enabled) {
            for (let button of resultBtns) {
                button.disabled = !enabled;
                if (button.classList.contains("chosen") && !enabled) button.classList.remove("chosen");
            }
            if (!enabled) page.querySelector("#auto-target-result").dataset.chosen = "";
        };
        createSelectMenu(page.querySelector("#auto-target"), chosen => enableButtons(chosen != null));
        createSelectMenu(page.querySelector("#auto-target-result"));
        page.querySelectorAll("p").forEach(p => createNumInput(p));
        page.querySelector("#submit-match").onclick = function() {
            var data = {};
            data.autoTarget = page.querySelector("#auto-target").dataset.selected;
            data.autoSuccess = page.querySelector("#auto-target-result").dataset.selected;
            data.teleopSwitch = parseInt(page.querySelector("#teleop-switch ons-input").value, 10);
            data.teleopScale = parseInt(page.querySelector("#teleop-scale ons-input").value, 10);
            data.teleopVault = parseInt(page.querySelector("#teleop-vault ons-input").value, 10);
            data.comments = page.querySelector("textarea").value;
            data.timestamp = Date.now(); // just for fun idk
            data.teamName = team.nickname.trim();
            data.teamNum = team.team_number;
            writeScoutingData(data);
            console.log(data);
        };
    }
});
