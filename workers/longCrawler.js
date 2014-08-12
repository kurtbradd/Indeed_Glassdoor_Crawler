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
	

	numberOfReviews = 0;
	createIndeedJobsDataPromise = createIndeedJobsData(indeedURL);
	createGlassdoorJobsDataPromise = createGlassdoorJobsData(glassdoorURL);

	createIndeedJobsDataPromise
	.then(function(indeedJobs){
		numberOfReviews+= indeedJobs.length;
		createJobs(indeedJobs, 'indeedLongCrawl', function(completedJobs) {
		})
		.then(function(reviews) {
		})
	});
	
	createGlassdoorJobsDataPromise
	.then(function(glassdoorJobs){
		numberOfReviews+= glassdoorJobs.length;
		createJobs(glassdoorJobs, 'glassdoorLongCrawl', function(completedJobs) {
		})
		.then(function(reviews) {
		})
	});


}

jobsProc.process('indeedLongCrawl', 200, function (job, done) {
	indeed.getReviewsFromURL(job.data.url, job.data.featured)
	.then(function(reviews){
		job.send("result", reviews);
    done();
	})
	.fail(function(error){
		done(error)
	});
})

jobsProc.process('glassdoorLongCrawl', 10, function (job, done) {
	glassdoor.getReviewsFromURL(job.data.url)
	.then(function(reviews){
		job.send("result", reviews);
    done();
	})
	.fail(function(error){
		console.log('glassdoor failed')
		done(error)
	});
})

// Type = indeedLongCrawl | glassdoorLongCrawl
function createJobs (indeedJobs, type) {
	var deferred = Q.defer();
	var reviews = []
	var jobPromises = [];
	completeCount = 0;
	// Create Job Instances
	_.forEach(indeedJobs, function(jobData) {
		var deferredJob = Q.defer();
		job = jobsMake.create(type, jobData);
		job.attempts(20);
		job.delay(1000);
		jobPromises.push(deferredJob.promise);
		job.on('result', function(reviewsArray) {
			reviews = reviews.concat(reviewsArray);
			console.log(++completeCount);
			deferredJob.resolve();
		})
		job.on('failed attempt', function () {
			console.log('failed job attempt')
		})
		job.on('failed', function (err) {
			console.log('something failed');
			deferredJob.reject(err);
		})
		job.save();
	})
	// Wait for all Job instances to complete
	Q.all(jobPromises)
	.then(function(data) {
		console.log('ALL COMPLETE');
		console.log(reviews.length);
		deferred.resolve(reviews);
	})
	.fail(function(error){
		console.log('error');
		deferred.reject(error)
	});
	return deferred.promise;
};

function createIndeedJobsData (indeedURL) {
	console.log('creating job data');
	var deferred = Q.defer();
	jobs = [];
	PAGINATE_URL1 		= "?start="; //page index goes after = sign ex20
	PAGINATE_URL2 		= "&lang=en";
	REVIEWS_PER_PAGE 	= 20;

	indeed.getNumberOfReviews(indeedURL)
	.then(function(numReviews){
		console.log('got number of reviews');
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE);
		console.log(numPages);
		for (i=0; i<2; i++) {
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

function createGlassdoorJobsData (glassdoorURL) {
	console.log('creating job data');
	var deferred = Q.defer();
	jobs = [];

	var PAGINATE_URL1			= "_P2.htm";
	var REVIEWS_PER_PAGE 	= 10;

	glassdoor.getNumberOfReviews(glassdoorURL)
	.then(function(numReviews){
		console.log(numReviews)
		console.log('got number of reviews');
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE);
		console.log(numPages);
		for (i=0; i<2; i++) {
			pageIndex = i+1;
			newURL = glassdoorURL.replace('.htm', '');
			searchURL = newURL + '_P' + pageIndex + '.htm';
			data = {
				url:searchURL
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