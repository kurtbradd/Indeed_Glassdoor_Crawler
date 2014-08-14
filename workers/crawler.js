var glassdoor = require('./glassdoor_crawler');
var indeed 		= require('./indeed_crawler');
var json2csv 	= require('json2csv');
var fs 				= require('fs');
var Q 				= require('q');

var URL_GLASSDOOR 			= "http://www.glassdoor.ca/Reviews/Google-Reviews-E9079.htm";
var URL_INDEED 					= "http://www.indeed.com/cmp/Google/reviews";

exports.crawlReviews = function crawlReviews(indeedURL, glassdoorURL, reviewID, cb) {
	var deferred = Q.defer();
	var reviewsArray = [];
	var reviewError = false;
	var glassdoorPercentComplete = 0;
	var indeedPercentComplete = 0;

	var GD = glassdoor.crawlGlassdoorReview(glassdoorURL, function (percentComplete){
		glassdoorPercentComplete = percentComplete;
		cb((((glassdoorPercentComplete+indeedPercentComplete)/2)*100).toFixed(2));
	})
	.then(function(reviews) {
		reviewsArray = reviewsArray.concat(reviews);
	})
	.fail(function(error) {
		reviewError = true;
		deferred.reject(error);
	});

	var ID = indeed.crawlIndeedReview(indeedURL, function (percentComplete){
		indeedPercentComplete = percentComplete;
		cb((((glassdoorPercentComplete+indeedPercentComplete)/2)*100).toFixed(2));
	})
	.then(function(reviews) {
		reviewsArray = reviewsArray.concat(reviews);
	})
	.fail(function(error) {
		reviewError = true;
		deferred.reject(error);
	});

	Q.all([GD, ID])
	.then(function() {
		if (!reviewError){
			parseReviewsToCSV(reviewID, reviewsArray, function(error, savedFilePath) {
				if (!error) {
					deferred.resolve(savedFilePath);
				}
				deferred.reject(error);
			})
		}
	});

	return deferred.promise;

};

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