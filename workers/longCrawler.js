console.log('long worker');
var glassdoor = require('./glassdoor_crawler');
var indeed 		= require('./indeed_crawler');
var _ 				= require('lodash');
var json2csv 	= require('json2csv');
var fs 				= require('fs');
var Q 				= require('q');

var kue 			= require("kue-send");
var jobsMake	= kue.createQueue();
var jobsProc 	= kue.createQueue();


exports.crawlReviews = function crawlReviews(indeedURL, glassdoorURL, reviewID, cb) {
	
	indeedJobsToFulfill = [];
	glassdoorJobsToFulfill = []
	numberOfReviews = 0;
	numberOfReviewsFinished = 0;
	createIndeedJobsDataPromise = createIndeedJobsData(indeedURL);
	createGlassdoorJobsDataPromise = createGlassdoorJobsData(glassdoorURL);
	fetchIndeedReviewsPromise = []; 
	fetchGlassdoorReviewsPromise = [];



	createIndeedJobsDataPromise
	.then(function(indeedJobs){
		console.log('done creating indeed jobs');
		indeedJobsToFulfill = indeedJobs;
		numberOfReviews+= indeedJobs.length;
	});
	
	createGlassdoorJobsDataPromise
	.then(function(glassdoorJobs){
		console.log('done creating glassdoor jobs');
		glassdoorJobsToFulfill = glassdoorJobs;
		numberOfReviews+= glassdoorJobs.length;
	});

	Q.all([createIndeedJobsDataPromise, createGlassdoorJobsDataPromise])
	.then(function(data) {
		console.log('fetching all jobs');

		fetchIndeedReviewsPromise = createJobs(indeedJobsToFulfill, 'indeedLongCrawl', function(completedJobs) {
			console.log('indeed complete ' + completedJobs + '/' + indeedJobsToFulfill.length)
		})

		fetchGlassdoorReviewsPromise = createJobs(glassdoorJobsToFulfill, 'glassdoorLongCrawl', function(completedJobs) {
			console.log('glassdoor complete ' + completedJobs + '/' + glassdoorJobsToFulfill.length)
		})

		Q.all([fetchGlassdoorReviewsPromise, fetchIndeedReviewsPromise])
		.then(function(data) {
			console.log('All reviews fetched, ready for CSV build.')
			var allReviews = data[0].concat(data[1]);

			parseReviewsToCSV(reviewID, allReviews, function(error, savedFilePath) {
				if (!error) {
					console.log('CSV saved');
					console.log(savedFilePath);
					// deferred.resolve(savedFilePath);
				}
				// deferred.reject(error);
			})
		})
		.fail(function(error) {
			console.log('something went wrong while fetching the jobs');
			console.log(error);
		});

	})
	.fail(function(error){
		console.log('something went wrong while creating the jobs');
		console.log(error);
	});


}

jobsProc.process('indeedLongCrawl', 200, function (job, done) {
	indeed.getReviewsFromURL(job.data.url, job.data.featured)
	.then(function(reviews){
		job.send("result", reviews);
    done();
	})
	.fail(function(error){
		console.log('indeed failed');
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
// cb(numCompletedJobs)
function createJobs (indeedJobs, type, cb) {
	console.log('create jobs called');
	var deferred = Q.defer();
	var reviews = []
	var jobPromises = [];
	var completeCount = 0;

	// Create Job Instances
	_.forEach(indeedJobs, function(jobData) {
		var deferredJob = Q.defer();
		var job = jobsMake.create(type, jobData);
		job.attempts(20);
		job.delay(1000);
		jobPromises.push(deferredJob.promise);
		job.on('result', function(reviewsArray) {
			reviews = reviews.concat(reviewsArray);
			cb(++completeCount);
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
	var jobs = [];
	var PAGINATE_URL1 		= "?start="; //page index goes after = sign ex20
	var PAGINATE_URL2 		= "&lang=en";
	var REVIEWS_PER_PAGE 	= 20;

	indeed.getNumberOfReviews(indeedURL)
	.then(function(numReviews){
		console.log(numReviews + ' indeed reviews');
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE);
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
	var jobs = [];
	var PAGINATE_URL1			= "_P2.htm";
	var REVIEWS_PER_PAGE 	= 10;

	glassdoor.getNumberOfReviews(glassdoorURL)
	.then(function(numReviews){
		console.log(numReviews + ' glassdoor reviews');
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE);
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

// callback(error, savedFilePath)
function parseReviewsToCSV(reviewID, array, callback) {
	csvConfig = {
		data: array, 
		
		fields: ['title', 'date','content_pros', 'content_cons',
		'rating_company', 'rating_job_work_life_balance', 'rating_job_security',
		'rating_management', 'rating_compensation_benefits', 'rating_job_culture',
		'advice_senior_mgmt','advice_would_recommend','ceo_approval' ,'content_description'],

		fieldNames: ['Title', 'Date', 'Pros', 'Cons', 'Company Rating', 
		'Job/Work Life Balance', 'Job Security','Company Management', 'Compensation & Benefits',
		'Company Culture','Senior Mgmt Advice', 'Would Recommend', 'CEO Approval', 'Review Description']
	}

	json2csv(csvConfig, function(err, csv) {
	  if (err) {
	  	callback(err);
	  } else {
	  	var fileName = reviewID + '_review.csv';
	  	var filePath = '../public/render/reviews/'+ fileName;
	  	fs.writeFile(filePath, csv, function(err) {
	    	if (err){
	    		callback(err);
	    		return;
	    	}
	    	callback(false, fileName);
	  	});
		}
	});	
}