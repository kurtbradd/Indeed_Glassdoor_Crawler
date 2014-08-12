var cluster = require('cluster')
var clusterWorkerSize = require('os').cpus().length;


if (cluster.isMaster) {
	for (var i = 0; i < clusterWorkerSize; i++) {
		cluster.fork();
	}
}
else {
	var	kue 		= require('kue'),
			crawler = require('./crawler.js'),
			longCrawler = require('./longCrawler.js'),
			jobs 		= kue.createQueue();

	jobs.process('crawlURL', 1, function (job, done){
			var crawlPromise = crawler.crawlReviews(job.data.indeed_url, job.data.glassdoor_url, job.data.review_id, function(percent){
				console.log(percent);
				job.progress(percent, 100);
			});
			crawlPromise
			.then(function(savedFilePath){
				console.log(savedFilePath);
				mongoose = require('mongoose')
				mongoose.connect('mongodb://localhost:27017/WebCrawler')
    		Review = require('../models/Review.js');
				
    		Review.findById(job.data.review_id, function(error, review){
    			if (error) {
    				console.log(error);
    				done(error);
    				return;
    			}
    			console.log('gets here');
    			console.log(savedFilePath);
    			review.csv_file_path = savedFilePath;
    			review.save(function(error, review){
    				if (error){
    					console.log(error);
    					done(error);
    					return;
    				}
    				console.log(review);
    				mongoose.connection.close()
    				done();
    			})
    		});
			})
			.fail(function(error) {
				console.log(error);
				done(error);
			});
	});

	jobs.process('crawlUrlLong', 1, function (job, done) {
		console.log(job.data);
		longCrawler.crawlReviews(job.data.indeed_url, job.data.glassdoor_url, job.data.review_id, function(percent){
			// return overall percentage of slow crawl to front
		});
	})
}


process.once( 'SIGINT', function ( sig ) {
  jobs.shutdown(function(err) {
		console.log( 'Kue is shut down.', err||'' );
		process.exit( 0 );
  }, 5000 );
});