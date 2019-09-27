var app = express();
const port = process.env.PORT || 80;

app.use(bodyParser.json())

app.get('/process', (req, res) => {
  console.log('processing');
});


app.listen(port, () => console.log(`Choreographer API listening on port ${port}!`));