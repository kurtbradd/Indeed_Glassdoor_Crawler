var cluster = require('cluster')
var clusterWorkerSize = require('os').cpus().length;

if (cluster.isMaster) {
	for (var i = 0; i < clusterWorkerSize; i++) {
		cluster.fork();
	}
}
else {
	var kue 			= require("kue-send"),
			crawler = require('./crawler.js'),
			longCrawler = require('./longCrawler.js'),
			jobs 		= kue.createQueue();

	jobs.process('crawlURL', 1, function (job, done){
			var crawlPromise = crawler.crawlReviews(job.data.indeed_url, job.data.glassdoor_url, job.data.review_id, function(percent){
				console.log("Percent Complete: " + percent + " (normal crawl)");
				job.progress(percent, 100);
			});
			crawlPromise
			.then(function (savedFilePath){
				saveReview(savedFilePath, job, done);
			})
			.fail(function (error) {
				console.log(error);
				job.send("failed", error);
			});
	});

	jobs.process('crawlUrlLong', 1, function (job, done) {
		var crawlPromise = longCrawler.crawlReviews(job.data.indeed_url, job.data.glassdoor_url, job.data.review_id, function(percent){
			console.log("Percent Complete: " + percent + " (long crawl)");
			job.progress(percent, 100);
		});
		crawlPromise
		.then(function (savedFilePath){
			saveReview(savedFilePath, job, done);
		})
		.fail(function (error) {
			console.log(error);
			job.send("failed", error);
		});
	})
}


function saveReview(savedFilePath, job, done) {
	mongoose = require('mongoose')
	mongoose.connect('mongodb://localhost:27017/WebCrawler')
	Review = require('../models/Review.js');
	
	Review.findById(job.data.review_id, function (error, review){
		if (error) {
			job.send("failed", error);
			return;
		}
		review.csv_file_path = savedFilePath;
		review.save(function (error, review){
			if (error){
				job.send("failed", error);
				return;
			}
			mongoose.connection.close()
			done();
		})
	});
}

process.once( 'SIGINT', function (sig) {
  jobs.shutdown(function(err) {
		console.log( 'Kue is shut down.', err||'' );
		process.exit( 0 );
  }, 5000 );
});