'use strict';

var state = 'ga', eventCode = 'gai', year = 2018;
var allTeams = [];

var getTeamByNumber = function(num) {
    num = num.toString();
    for (let team of allTeams) {
        if (team.team_number.toString() === num) {
            return team;
        }
    }
};

document.addEventListener('init', function (event) {
    console.log("Init", event.target.id);
    var page = event.target;
    // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
    if (page.matches("#home")) {
        var page = event.target;
        // var pullHook = page.querySelector("#pull-hook");
        // var icon = page.querySelector("#pull-hook-icon");

        // console.log('els', pullHook, icon);

        // pullHook.addEventListener('changestate', function (event) {
        //     console.log(event);
        //     switch (event.state) {
        //         case 'initial':
        //             icon.setAttribute('icon', 'fa-arrow-down');
        //             icon.removeAttribute('rotate');
        //             icon.removeAttribute('spin');
        //             break;
        //         case 'preaction':
        //             icon.setAttribute('icon', 'fa-arrow-down');
        //             icon.setAttribute('rotate', '180');
        //             icon.removeAttribute('spin');
        //             break;
        //         case 'action':
        //             icon.setAttribute('icon', 'fa-spinner');
        //             icon.removeAttribute('rotate');
        //             icon.setAttribute('spin', true);
        //             icon.setAttribute('animated');
        //             icon.setAttribute('faa-flashing');
        //             break;
        //     }
        // });
        // var getTeams = function (page) {
        //     return new Promise(
        //         function (resolve) {
        //             // axios({
        //             //     method: 'get',
        //             //     url: `https://www.thebluealliance.com/api/v3/teams/${page}`,
        //             //     headers: {'X-TBA-Auth-Key': ' S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e'}
        //             // }).then(function (response) {
        //             //     console.log(response.data);
        //             //     resolve(response.data);
        //             // });
        //         }
        //     );
        //
        // };
        // var getTeamName = function () {
        //     getTeams(1).then(function (teams) {
        //         teamsBlueAlliance = teams;
        //     });
        //     console.log(teamsBlueAlliance);
        //     // var names = ['blim blam', 'kabla', 'asdfadsfasdf', 'asdf', '32142342n3nnifinn'];
        //     names = teams.map(function (team) {
        //         return team.name;
        //     })
        //
        //
        // };
        // var getTeamNumber = function () {
        //     // const width = 40 + Math.floor(20 * Math.random());
        //     return Math.random() * 10000;
        // };
        // var teamsBlueAlliance = null;
        // var maxPage = 40; // for blue alliance
        var getTeams = function () {
            var randomPage = 1;
            return axios({
                method: 'get',
                url: `https://www.thebluealliance.com/api/v3/event/${year}${state}${eventCode}/teams/simple`,
                headers: {'X-TBA-Auth-Key': ' S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e'}
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
        // var teams = getRandomData();
        // for (team of teams) {
        //     var teamEl = createTeam(team);
        //     document.getElementById('teams-list').appendChild(teamEl);
        // }
        var fetchTeams = function (done) {
            getTeams().then(function(teams) {
                addTeams(teams, []);
                if (done) done();
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
                document.getElementById("appNavigator").pushPage(`${this.id}-scout.html`, {data: {title: "Home", team: teamObj}});
            }
        }
    } else if (page.matches("#match-scout") || page.matches("#pit-scout")) {
        var isMatch = page.matches("#match-scout"), team = page.data.team;
        console.log(team);
        page.querySelector("#team-title").innerHTML = team.nickname;
        page.querySelector("#team-num").innerHTML = team.team_number;
        page.querySelector("#team-name").innerHTML = team.nickname;
        if (isMatch) {
            var target = -1, success = false, chosen = null;
            var targetBtns = page.querySelectorAll("#auto-target ons-button");
            var resultBtns = page.querySelectorAll("#auto-target-result ons-button");
            var enableButtons = function(enabled) {
                for (let button of resultBtns) button.disabled = !enabled;
            };
            for (let button of targetBtns) {
                button.onclick = function() {
                    target = this.dataset.target;
                    this.classList.add("chosen");
                    if (chosen) chosen.classList.remove("chosen");
                    if (this != chosen) {
                        chosen = this;
                        enableButtons(true);
                    } else {
                        chosen = null;
                        enableButtons(false);
                    }
                };
            }
        }
    }
});
