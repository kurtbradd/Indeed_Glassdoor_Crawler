var glassdoor = require('./glassdoor_crawler');
var indeed 		= require('./indeed_crawler');
var _ 				= require('lodash');
var json2csv 	= require('json2csv');
var fs 				= require('fs');
var Q 				= require('q');

var kue 			= require("kue-send");
var jobsMake	= kue.createQueue();
var jobsProc 	= kue.createQueue();

// cb(percentComplete);
exports.crawlReviews = function crawlReviews(indeedURL, glassdoorURL, reviewID, cb) {
	
	var deferred = Q.defer();

	indeedJobsToFulfill = [];
	glassdoorJobsToFulfill = []
	numberOfReviews = 0;
	numberOfReviewsFinished = 0;
	indeedReviewsFinished = 0;
	glassdoorReviewsFinished = 0;
	createIndeedJobsDataPromise = createIndeedJobsData(indeedURL);
	createGlassdoorJobsDataPromise = createGlassdoorJobsData(glassdoorURL);
	fetchIndeedReviewsPromise = []; 
	fetchGlassdoorReviewsPromise = [];


	createIndeedJobsDataPromise
	.then(function (indeedJobs){
		indeedJobsToFulfill = indeedJobs;
		numberOfReviews+= indeedJobs.length;
	});
	
	createGlassdoorJobsDataPromise
	.then(function (glassdoorJobs){
		glassdoorJobsToFulfill = glassdoorJobs;
		numberOfReviews+= glassdoorJobs.length;
	});

	Q.all([createIndeedJobsDataPromise, createGlassdoorJobsDataPromise])
	.then(function (data) {

		fetchIndeedReviewsPromise = createJobs(indeedJobsToFulfill, 'indeedLongCrawl', function (completedJobs) {
			indeedReviewsFinished = completedJobs;
			console.log(completedJobs + "/" + indeedJobsToFulfill.length + ": indeed")
			console.log(glassdoorReviewsFinished + "/" + glassdoorJobsToFulfill.length + ": glassdoor")
			cb(percentComplete());
		})

		fetchGlassdoorReviewsPromise = createJobs(glassdoorJobsToFulfill, 'glassdoorLongCrawl', function (completedJobs) {
			glassdoorReviewsFinished = completedJobs;
			console.log(indeedReviewsFinished + "/" + indeedJobsToFulfill.length + ": indeed")
			console.log(completedJobs + "/" + glassdoorJobsToFulfill.length + ": glassdoor")
			cb(percentComplete());
		})

		Q.all([fetchGlassdoorReviewsPromise, fetchIndeedReviewsPromise])
		.then(function (data) {
			var allReviews = data[0].concat(data[1]);

			parseReviewsToCSV(reviewID, allReviews, function (error, savedFilePath) {
				if (!error) {
					console.log('CSV saved');
					deferred.resolve(savedFilePath);
				}
				deferred.reject("Could Not Save CSV.");
			})
		})
		.fail(function (error) {
			deferred.reject('Oops, something went wrong while crawling for reviews.');
		});

	})
	.fail(function (error){
		deferred.reject("Hmm, we cant find the amount of reviews to crawl. Is the URL correct?");
	});

	function percentComplete() {
		return (((indeedReviewsFinished+glassdoorReviewsFinished)/numberOfReviews)*100).toFixed(2)
	}

	return deferred.promise;
}


jobsProc.process('indeedLongCrawl', 200, function (job, done) {
	indeed.getReviewsFromIndeedURL(job.data.url, job.data.featured)
	.then(function (reviews){
		job.send("result", reviews);
    done();
	})
	.fail(function (error){
		done(error);
	});
})

jobsProc.process('glassdoorLongCrawl', 15, function (job, done) {
	glassdoor.getReviewsFromGlassdoorURL(job.data.url)
	.then(function (reviews){
		job.send("result", reviews);
    done();
	})
	.fail(function (error){
		done(error)
	});
})

// Type = indeedLongCrawl | glassdoorLongCrawl
// cb(numCompletedJobs)
function createJobs (indeedJobs, type, cb) {
	var deferred = Q.defer();
	var reviews = []
	var jobPromises = [];
	var completeCount = 0;

	_.forEach(indeedJobs, function (jobData) {
		var deferredJob = Q.defer();

		var job = jobsMake.create(type, jobData);
		job.attempts(35);
		job.backoff( function (attempts, delay){
      return 500*attempts;
    });
		// job.delay(1000);
		jobPromises.push(deferredJob.promise);
		job.on('result', function (reviewsArray) {
			reviews = reviews.concat(reviewsArray);
			cb(++completeCount);
			deferredJob.resolve();
		})
		job.on('failed attempt', function () {
			console.log('Failed Crawl Job Attempt')
		})
		job.on('failed', function () {
			deferredJob.reject();
		})
		job.save();
	})
	
	Q.all(jobPromises)
	.then(function (data) {
		deferred.resolve(reviews);
	})
	.fail(function (error){
		deferred.reject()
	});
	return deferred.promise;
};

function createIndeedJobsData (indeedURL) {
	var deferred = Q.defer();
	var jobs = [];
	var PAGINATE_URL1 		= "?start="; //page index goes after = sign ex20
	var PAGINATE_URL2 		= "&lang=en";
	var REVIEWS_PER_PAGE 	= 20;

	indeed.getNumberOfIndeedReviews(indeedURL)
	.then(function (numReviews){
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE);
		console.log(numReviews + " Indeed Reviews");
		console.log(numPages + " Indeed Pages");
		for (i=0; i<numPages; i++) {
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
	.fail(function (error) {
		deferred.reject();
	})
	return deferred.promise;
}

function createGlassdoorJobsData (glassdoorURL) {
	var deferred = Q.defer();
	var jobs = [];
	var PAGINATE_URL1			= "_P2.htm";
	var REVIEWS_PER_PAGE 	= 10;

	glassdoor.getNumberOfGlassdoorReviews(glassdoorURL)
	.then(function (numReviews){
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE);
		console.log(numReviews + " Glassdoor Reviews");
		console.log(numPages + " Glassdoor Pages");
		for (i=0; i<numPages; i++) {
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
	.fail(function (error) {
		deferred.reject();
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

	json2csv(csvConfig, function (err, csv) {
	  if (err) {
	  	callback(err);
	  } else {
	  	var fileName = reviewID + '_review.csv';
	  	var filePath = '../public/render/reviews/'+ fileName;
	  	fs.writeFile(filePath, csv, function (err) {
	    	if (err){
	    		callback(err);
	    		return;
	    	}
	    	callback(false, fileName);
	  	});
		}
	});	
}