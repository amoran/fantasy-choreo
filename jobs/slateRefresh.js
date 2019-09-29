

module.exports = function(agenda) {
  agenda.define('slate refresh', {priority: 'high', concurrency: 1}, async job => {
    const {sport} = job.attrs.data;
    console.log(`Refreshing ${sport} slates`);
  });
}