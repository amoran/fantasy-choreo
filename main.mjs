import axios from 'axios';
import express from 'express';
import bodyParser from 'body-parser';

var app = express();
const port = process.env.PORT || 80;

app.use(bodyParser.json())

app.get('/process', (req, res) => {
  console.log('Getting slates...');
  axios.get('http://fanduel-api.herokuapp.com/slates/nfl')
  .then(slatesResponse => {
    let playersAxios = slatesResponse.data.map(slate => {
      return axios.get(`http://fanduel-api.herokuapp.com${slate.players}`);
    })

    console.log('Getting players for each slate...');

    axios.all(playersAxios)
    .then(axios.spread((...playersResponses) => {
      let lineupsAxios = playersResponses.map((playerResponse, slateIndex) => {
        // let slateId = slatesResponse.data[slateIndex].id;
        return axios.post(`http://fantasypy.herokuapp.com/api/lineup`, playerResponse.data);
      });

      console.log('Getting lineups for each slate...');

      axios.all(lineupsAxios)
      .then(axios.spread((...lineupsResponses) => {
        lineupsResponses.map((lineupsResponse, slateIndex) => {
          let slateId = slatesResponse.data[slateIndex].id;
          // console.log(`Received lineup for slate ${slateId} with details ${JSON.stringify(lineupsResponse.data)}`);
        });

        let contestsAxios = slatesResponse.data.map(slate => {
          return axios.get(`http://fanduel-api.herokuapp.com${slate.contests}`);
        });

        console.log('Getting contests for each slate...');

        axios.all(contestsAxios)
        .then(axios.spread((...contestsResponses) => {
          let contestsForSlates = contestsResponses.map(contestsResponse => {
            return contestsResponse.data.map(contest => contest.id);
          });

          let joinOrders = [];
          
          contestsForSlates.map((contestList, slateIndex) => {
            contestList.forEach(contest => {
              lineupsResponses[slateIndex].data.forEach(lineup => {
                let lineupData = lineup.players;
                console.log(`Entering contest ${contest} for algorithm ${lineup.algorithm}`);
                joinOrders.push({
                  url: `http://fanduel-api.herokuapp.com/contests/${contest}/entries`,
                  payload: lineupData
                });
              });
            });
          });

          console.log(JSON.stringify(joinOrders));
        }));
      }));
    }))
  })

});


app.listen(port, () => console.log(`Choreographer API listening on port ${port}!`));