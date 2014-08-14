var request = require('request');
var cheerio = require('cheerio');
var Q = require('q');

var URL 							= "http://www.glassdoor.ca/Reviews/Google-Reviews-E9079.htm";
var PAGINATE_URL1			= "_P2.htm";
var REVIEWS_PER_PAGE 	= 10;


exports.crawlGlassdoorReview = crawlGlassdoorReview = function crawlGlassdoorReview(url, percentComplete) {
	var deferred = Q.defer();
	var promisesArray = [];
	var reviewsArray = [];
	var completedPromises = 0;
	getNumberOfReviews(url)
	.then(function(numReviews){
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE)
		// REMOVE IN PRODUCTION
		//numPages = (numPages > 100) ? (1) : (numPages);
		console.log('num of glassdoor pages = ' + numPages)
		for (i=0; i<1; i++) {
			pageIndex = i+1;
			newURL = url.replace('.htm', '');
			searchURL = newURL + '_P' + pageIndex + '.htm';
			promise = getReviewsFromURL(searchURL);
			promisesArray.push(promise);
			promise
			.then(function(reviews){
				completedPromises++;
				//console.log('Completed: ' + completedPromises + '/' + promisesArray.length);
				percentComplete((completedPromises/promisesArray.length));
				reviewsArray = reviewsArray.concat(reviews);
			})
			.fail(function(error){
				deferred.reject(error);
			});
		}

		Q.all(promisesArray)
		.then(function() {
			deferred.resolve(reviewsArray);
		})
		.fail(function(error){
			deferred.reject(error);
		});

	})
	.fail(function(error){
		deferred.reject(error);
	});
	return deferred.promise;
}

exports.getNumberOfReviews = getNumberOfReviews = function getNumberOfReviews(url) {
	var deferred = Q.defer();
	request(url, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var $ = cheerio.load(body);
			// companyLabel = $('.counts').find('.notranslate').text();
			companyLabel = $('.employerStats').find('.ratingInfo').find('.hideHH').find('.notranslate').text();
			companyLabel = companyLabel.replace(',', '');
			companyLabel = companyLabel.replace(' Reviews', '');
			deferred.resolve(parseFloat(companyLabel));
		} else {
			deferred.reject('Could not get reviews from Glassdoor');
		}
	});
	return deferred.promise;
}

exports.getReviewsFromURL = getReviewsFromURL = function getReviewsFromURL(url) {
	console.log('Fetching URL: ' + url);
	var deferred = Q.defer();
	request(url, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			deferred.resolve(parseBodyForReviews(body));		
		} else {
			deferred.reject('Could not get reviews from Glassdoor');
		}
	});
	return deferred.promise;
}

function parseBodyForReviews (body) {
	var reviewsArray = [];
	var $ = cheerio.load(body);

	$('.hreview').filter(function(){
		review_data 		= $(this);

		// review_data = $('.hreview').eq(0);
		//console.log(review_data);
		review_details 	= review_data.find('.details');
		review_ratings 	= review_data.find('.cf').children();
		rating_count 		= review_ratings.find('.gdBars').length;
		
		review_title 		= review_data.find('.summary').eq(1).text();
		review_date 		= review_data.find('.SL_date').text()

		content_pros 		= review_data.find('.pro').children().eq(1).text();
		content_cons 		= review_data.find('.con').children().eq(1).text();
		rating_company	= review_data.find('.rating').children().attr('title');
		rating_job_culture 						= review_ratings.eq(0).find('.gdBars').attr('title');
		rating_job_work_life_balance 	= review_ratings.eq(1).find('.gdBars').attr('title');
		rating_management 						= review_ratings.eq(2).find('.gdBars').attr('title');
		rating_compensation_benefits 	= review_ratings.eq(3).find('.gdBars').attr('title');
		rating_job_security 					= review_ratings.eq(4).find('.gdBars').attr('title');
		ceo_approval 									= review_ratings.find('.gdApprovalDesc').text();
		//old reviews only have 4 sections
		if (rating_count == 4) {
			rating_job_culture 						= '';
			rating_job_work_life_balance 	= review_ratings.eq(0).find('.gdBars').attr('title');
			rating_management 						= review_ratings.eq(1).find('.gdBars').attr('title');
			rating_compensation_benefits 	= review_ratings.eq(2).find('.gdBars').attr('title');
			rating_job_security 					= review_ratings.eq(3).find('.gdBars').attr('title');
		} 

		ADVICE_SENIOR_MGMT 	= 'Advice to Senior Management';
		WOULD_RECOMMEND 		= 'Yes, I would recommend this company to a friend';
		NOT_RECOMMEND				= 'No, I would not recommend this company to a friend';

		advice_senior_mgmt				= '';
		advice_would_recommend 		= '';
		advice_data 							= review_data.find('.con');
		//if senior mgmt response then next should be would/wouldnot recommend
		if (advice_data.next().children().eq(0).text() == ADVICE_SENIOR_MGMT) {
			advice_senior_mgmt = advice_data.next().children().eq(1).text()
			//check if next element is WOULD_RECOMMEND or NOT_RECOMMEND
			switch(advice_data.next().next().children().eq(0).text()) {
				case WOULD_RECOMMEND:
					advice_would_recommend = 'YES';
					break;
				case NOT_RECOMMEND:
					advice_would_recommend = 'NO';
					break;
			}

		}
		//only would/wouldnot recommend
		else {
			switch(advice_data.next().children().eq(0).text()) {
				case WOULD_RECOMMEND:
					advice_would_recommend = 'YES';
					break;
				case NOT_RECOMMEND:
					advice_would_recommend = 'NO';
					break;
				default:
					advice_would_recommend = '';
					break;
			}
		}
		
		review = {
			'title':review_title,
			'date':review_date,
			'content_pros':sanitizeString(content_pros),
			'content_cons':sanitizeString(content_cons),
			'advice_senior_mgmt':sanitizeString(advice_senior_mgmt),
			'advice_would_recommend':sanitizeString(advice_would_recommend),
			'rating_company': rating_company,
			'rating_job_culture':rating_job_culture,
			'rating_job_work_life_balance':rating_job_work_life_balance,
			'rating_management':rating_management,
			'rating_compensation_benefits':rating_compensation_benefits,
			'rating_job_security':rating_job_security,
			'ceo_approval':ceo_approval
		}
		//console.log(review);
		reviewsArray.push(review);
	});

	//console.log(reviewsArray);
	return reviewsArray;
}

function sanitizeString(string){
	if (string.substring(0,2) == '- ') {
		return string.slice(2);
	}
	return string;
}