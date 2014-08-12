console.log('long worker');
var glassdoor = require('./glassdoor_crawler');
var indeed 		= require('./indeed_crawler');
var _ 				= require('lodash');
var json2csv 	= require('json2csv');
var fs 				= require('fs');
var Q 				= require('q');

// var kue 			= require('kue');
var kue 			= require("kue-send");
var jobsMake	= kue.createQueue();
var jobsProc 	= kue.createQueue();


// var kue = require("kue-send");
// var jobs = kue.createQueue();

var URL_GLASSDOOR 			= "http://www.glassdoor.ca/Reviews/Google-Reviews-E9079.htm";
var URL_INDEED 					= "http://www.indeed.com/cmp/Google/reviews";

exports.crawlReviews = function crawlReviews(indeedURL, glassdoorURL, reviewID, cb) {

	createIndeedJobsData(indeedURL)
	.then(function(indeedJobs){
		createIndeedJobs(indeedJobs);
	});


	// Q.all([])
	// .then(function(){
	// 	// if no errors in other promises
	// 	// then continue
	// })


	// cb is for percent... return overall percent for full crawl	

	// keep count of all jobs....as one completes calculate new percentage complete

	// get urls for indeed
	// get urls for glassdoor
	// iterate over each set and call the appropriate
	// crawl & parse methods
	// as each job completes store the review data in an array
	// parse the array into CSV

	// if job fails, notify parent job of failure
}

function createIndeedJobs (indeedJobs) {
	var deferred = Q.defer();
	var reviews = []
	var jobPromises = [];
	console.log('creating indeed jobs')

	_.forEach(indeedJobs, function(jobData) {
		var deferredJob = Q.defer();
		job = jobsMake.create('longtask', jobData)
		jobPromises.push(deferredJob.promise);
		job.on('result', function(reviewsArray) {
			console.log('Job Complete')
			reviews = reviews.concat(reviewsArray);
			deferredJob.resolve();
		})
		job.on('failed', function (err) {
			console.log(err);
			deferredJob.reject(err);
		})
		job.save();
	})

	console.log(jobPromises);

	Q.all(jobPromises)
	.then(function(data) {
		console.log(reviews.length);
		deferred.resolve(reviews);
	})
	.fail(function(error){
		console.log('error');
		deferred.reject(error)
	});


	return deferred.promise;

};

jobsProc.process('longtask', 4, function (job, done) {
	indeed.getReviewsFromURL(job.data.url, job.data.featured)
	.then(function(reviews){
		job.send("result", reviews);
    done();
	})
	.fail(function(error){
		done(error)
	});
})


function createIndeedJobsData (indeedURL) {
	console.log(indeedURL);
	console.log('creating job data');
	var deferred = Q.defer();
	jobs = [];
	PAGINATE_URL1 		= "?start="; //page index goes after = sign ex20
	PAGINATE_URL2 		= "&lang=en";
	REVIEWS_PER_PAGE 	= 20;

	indeed.getNumberOfReviews(indeedURL)
	.then(function(numReviews){
		console.log('got numbver of reviews');
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE);
		console.log(numPages);
		for (i=0; i<4; i++) {
			pageIndex = i * REVIEWS_PER_PAGE;
			searchURL = indeedURL + PAGINATE_URL1 + pageIndex + PAGINATE_URL2;
			featured = (i == 0)?(true):(false);
			data = {
				url:searchURL,
				featured:featured
			}
			jobs = jobs.concat(data);
		}
		deferred.resolve(jobs);
	})
	.fail(function(error) {
		console.log(error);
		deferred.reject(error);
	})
	return deferred.promise;
}