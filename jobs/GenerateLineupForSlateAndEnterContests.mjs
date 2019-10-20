import axios from 'axios';
import {FANDUEL_WRAPPER_HOST, LINEUP_API_HOST} from '../constants.mjs';

export default function(agenda, db) {
  agenda.define('GenerateLineupForSlateAndEnterContests', {priority: 'high', concurrency: 1}, async job => {
    const {contestsUrl, id, label, playersUrl, salaryCap, startDate} = job.attrs.data;
    console.log(`(GenerateLineupForSlateAndEnterContests) Generating Lineups and Entering Contests for Slate ${id}`);

    // Get players in this slate
    axios.get(`${FANDUEL_WRAPPER_HOST}${playersUrl}`)
      .then(playersResponse => {

        // Generate lineup for these players
        axios.post(`${LINEUP_API_HOST}/api/lineup`, playersResponse.data)
          .then(lineupResponse => {
            let validLineups = lineupResponse.data.filter(lineup => {
              return lineup.players.length === 9;
            });

            console.log(`(GenerateLineupForSlateAndEnterContests) Generated ${validLineups.length} valid lineups for slateId ${id}`);

            // Get Available contests
            axios.get(`${FANDUEL_WRAPPER_HOST}${contestsUrl}`)
              .then(contestsResponse => {
                let availableContestIds = contestsResponse.data.map(contest => contest.id);
                console.log(`(GenerateLineupForSlateAndEnterContests) Available contests for slate ${id}: ${availableContestIds}`)

                // Upsert all contests to db
                db.collection('contests').updateMany({id: {$in: availableContestIds}}, contestsResponse.data, {upsert: true}, (err, res) => {
                  if (err) console.error(err);
                  console.log(`Saving ${res.result.nModified} contests to DB`);                  
                })

                // Get Current Rosters
                axios.get(`${FANDUEL_WRAPPER_HOST}/my/entriestest?slateId=${id}`)
                  .then(entriesResponse => {

                    // Get all entered contests for this slate
                    let enteredContests = entriesResponse.data.map(entry => {
                      return entry.id;
                    });
                    console.log(`(GenerateLineupForSlateAndEnterContests) Entered contests for slate ${id}: ${enteredContests}`);

                    // Trigger job to enter contest if not entered
                    let contestIdsToUpdate = availableContestIds.filter(contestId => {
                      if (enteredContests.indexOf(contestId) < 0) {
                        // Contest has not been entered, enter contest with all valid lineups.
                        agenda.now('JoinContestWithLineups', {
                          contest: contestId,
                          lineups: validLineups
                        });
                        
                        return false;
                      }

                      // only keep contestIds that need updates
                      return true;
                    });

                    console.log(`(GenerateLineupForSlateAndEnterContests) Updatable contests for slate ${id}: ${contestIdsToUpdate}`);

                    let rostersToUpdate = entriesResponse.data.reduce((acc, entry) => {
                      let newFormat = entry.rosterIds.map(rosterId => {
                        return {contestId: entry.id, rosterId};
                      });
                      return acc.concat(newFormat);
                    }, []);

                    let uniqueRostersToContests = {};
                    for (let i = 0; i < rostersToUpdate.length; i++) {
                      let entry = rostersToUpdate[i];

                      if (uniqueRostersToContests[entry.rosterId]) {
                        uniqueRostersToContests[entry.rosterId].push(entry.contestId);
                      } else {
                        uniqueRostersToContests[entry.rosterId] = [entry.contestId];
                      }
                    }

                    let rosterIds = Object.keys(uniqueRostersToContests);

                    let rosterAxioses = rosterIds.map(rosterId => {
                      return axios.get(`${FANDUEL_WRAPPER_HOST}/rosters/${rosterId}`);
                    });

                    axios.all(rosterAxioses)
                      .then(axios.spread((...rosterResponses) => {
                        let rosterLineupList = rosterResponses.forEach((rosterResponse, index) => {
                          let rosterId = rosterIds[index];
                          let existingLineup = rosterResponse.data;
                          let matchingContestId = uniqueRostersToContests[rosterId][0];

                          db.collection("entries").find({contestId: matchingContestId}).toArray(function(err, results) {
                            if (err) {
                              console.log(err);
                              return;
                            }

                            let foundEntry = results.find(result => {
                              return result.players.some(playersInstance => {
                                return playersInstance.every(player => {
                                  return existingLineup.some(existingPlayer => {
                                    return existingPlayer.id === player.id;
                                  }); 
                                });
                              });
                            });

                            if (!foundEntry) {
                              console.log(`Couldnt find entry for roster ${rosterId} and contest ${matchingContestId} with lineup ${JSON.stringify(existingLineup)}`)
                            }
                            
                            let algoName = foundEntry.algorithm;
                            if (algoName === null) {
                              // Whoops
                              console.log(`Why are we here... we should have been able to update this contest ${matchingContestId}`);
                              return;
                            }
  
                            let newLineup = validLineups.find(lineup => lineup.algorithm === algoName);
                            
                            let isSame = newLineup.players.every(player => {
                              return existingLineup.some(existingPlayer => {
                                return existingPlayer.id === player.id
                              });
                            });
                            
                            if (isSame) {
                              console.log(`(GenerateLineupForSlateAndEnterContests) No need to update roster ${rosterId} for slate ${id}, same lineup generated`);
                            } else {
                              agenda.now('UpdateRoster', {
                                roster: rosterId,
                                lineup: newLineup
                              });
                            }
                          })
                          
                        });

                      }))
                      .catch(error => {
                        console.log(`ERROR FETCHING ROSTERS`);
                        console.log(error);
                      });
                  })
                  .catch(error => {
                    console.log(`ERROR FETCHING CURRENT ROSTERS WITH SLATE ID ${id}`);
                    console.log(error);
                  });
              })
              .catch(error => {
                console.log(`ERROR FETCHING AVAILABLE CONTESTS FOR SLATE ID ${id}`);
                console.log(error);
              })
          })
          .catch(error => {
            console.log(`ERROR GENERATING LINEUPS FOR SLATE ID ${id}`);
            // console.log(error);
          });
      })
      .catch(error => {
        console.log(`ERROR FETCHING PLAYERS FOR SLATE ID ${id}`);
        console.log(error);
      });      
  });
}