var mongoose = require('mongoose'),
    Review = mongoose.model('Review'),
    jobQueue = require('../workers/jobQueue.js')

module.exports = {
	postLong: function (socketio) {
		return function (req, res) {
			startCrawl(req, res, socketio, 'crawlUrlLong');
		}
	},

	post: function (socketio) {
		return function (req, res){
			startCrawl(req, res, socketio, 'crawlURL');	
		}
	},
	get: function (req, res) {
		fieldsToReturn = 'company_name created_at csv_file_path failed'; 
		Review.find({}, fieldsToReturn, function(err, reviews) {
			if (err) {
				res.send(400);
				return;
			}
			res.send(reviews);
		});
	}
}

function startCrawl (req, res, socketio, crawlType) {
	if (req.body.company_name && req.body.glassdoor_url && req.body.indeed_url) {
		var review = new Review;
		review.company_name = req.body.company_name; 
  	review.glassdoor_url = req.body.glassdoor_url;
  	review.indeed_url = req.body.indeed_url;

  	review.save(function (err, saved_review) {
  		if (err) {
  			res.send(400);
  			return;
  		}

  		var job = {
  			company_name : saved_review.company_name,
  			review_id : saved_review._id,
  			indeed_url : saved_review.indeed_url,
  			glassdoor_url : saved_review.glassdoor_url
  		};

  		jobQueue.crawlURL(crawlType, job, function (error, completed, progress) {
  			if (error) {
          console.log("Error:: " + error);
  				socketio.sockets.in(req.session.id).emit('crawlFailed', error);

  				saved_review.failed = true;
  				saved_review.save(function (err, failed_review) {
  					if (!err && failed_review) {
  						console.log(failed_review);
  					}
  				})
  			}

  			if (completed) {
          console.log('Crawl complete');
  				socketio.sockets.in(req.session.id).emit('crawlComplete', {});
  			}

  			if (progress) {
  				console.log('Crawl Progress: ' + progress);
  				socketio.sockets.in(req.session.id).emit('crawlProgress', progress);
  			}
  		});
  		res.send(200);
  	});

	} else {
		res.send(400)
		console.log('missing paramaters');
	}
}