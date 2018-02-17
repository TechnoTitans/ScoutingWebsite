'use strict';

var state = 'ga', eventCode = 'gai', year = 2018;
var allTeams;

document.addEventListener('init', function (event) {
    console.log("Init");
    // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
    if (event.target.matches("#home")) {
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

        var createTeam = function (team) {
            return ons.createElement(`
              <ons-list-item>
              <div>
                ${team.nickname} - ${team.team_number}
                </div>
              </ons-list-item>
            `
            );
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
                        || team.team_number.toString().indexOf(term) !== -1))
                    page.querySelector("#teams-list").appendChild(createTeam(team));
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
    }
});