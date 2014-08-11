var testController 		= require('./testController.js');
var ReviewController 	= require('./ReviewController.js');

exports = module.exports = function(app, socketio) {

	// ReviewController
	app.get('/api/reviews', ReviewController.get);
	app.post('/api/reviews', ReviewController.post(socketio));
	app.post('/api/reviews/long', ReviewController.postLong(socketio));

	app.get('/public/render/reviews/:id', function (req, res) {
		res.download('./public/render/reviews/' + req.params.id, req.query.company_name +'.csv');
	})
	// Catchall Route
	app.get('*', function (req, res) {
		res.sendfile('./public/views/index.html');
	});
}