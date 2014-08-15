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

// getReviewsFromURL(URL);
getReviewsFromURL("http://www.glassdoor.ca/Reviews/Google-Reviews-E9079_P236.htm");

function parseBodyForReviews (body) {
	var reviewsArray = [];
	var $ = cheerio.load(body);

	$('.hreview').filter(function(){
		review_data 		= $(this);

		// review_data = $('.hreview').eq(0);
		review_title 		= review_data.find('.summary').eq(1).text();
		review_date 		= review_data.find('.SL_date').text()

		review_ratings 	= review_data.find('.gdRatings');
		subRatings 			= review_ratings.find('.subRatings').find('.undecorated').children();
		rating_count 		= subRatings.length;
		console.log(rating_count);
		
		rating_company								= review_ratings.find('.value-title').attr('title');
		rating_compensation_benefits 	= subRatings.eq(0).find('.gdBars').attr('title');
		rating_job_work_life_balance 	= subRatings.eq(1).find('.gdBars').attr('title');
		rating_management 						= subRatings.eq(2).find('.gdBars').attr('title');
		rating_job_culture 						= subRatings.eq(3).find('.gdBars').attr('title');
		rating_job_security 					= subRatings.eq(4).find('.gdBars').attr('title');
		//old reviews only have 4 sections
		if (rating_count == 4) {
			console.log('went to old ratings');
			rating_job_culture 						= "";
			rating_compensation_benefits 	= subRatings.eq(0).find('.gdBars').attr('title');
			rating_job_work_life_balance 	= subRatings.eq(1).find('.gdBars').attr('title');
			rating_management 						= subRatings.eq(2).find('.gdBars').attr('title');
			rating_job_security 					= subRatings.eq(3).find('.gdBars').attr('title');
		}

		if (rating_count == 0) {
			rating_compensation_benefits 	= "";
			rating_job_work_life_balance 	= "";
			rating_management 						= "";
			rating_job_culture 						= "";
			rating_job_security 					= "";
		}

		review_description	= review_data.find('.description');
		prosConsAdvice 			= review_description.find('.prosConsAdvice');
		content_pros 				= prosConsAdvice.find('.pros').text();
		content_cons 				= prosConsAdvice.find('.cons').text();
		advice_senior_mgmt	= "";
		
		// if == 3 that means has section for advice mgmt
		if (prosConsAdvice.children().length == 3) {
			advice_senior_mgmt = prosConsAdvice.find('.adviceMgmt').text();
		}

		employeeReviewChildren 		= review_description.find('.padBotLg').find('.fill').children();
		recommendsCompanyDiv 			= employeeReviewChildren.eq(0);
		recommendsCeoDiv 					= employeeReviewChildren.eq(2);
		advice_would_recommend 		= "";
		ceo_approval 							= "";

		if (recommendsCompanyDiv.children().length > 0) {
			square = recommendsCompanyDiv.find('.sqLed');
			if (square.hasClass('green')) {
				advice_would_recommend = "YES";
			}
			if (square.hasClass('red')) {
				advice_would_recommend = "NO";		
			}
		}

		if (recommendsCeoDiv.children().length > 0) {
			square = recommendsCeoDiv.find('.sqLed');
			if (square.hasClass('green')) {
				ceo_approval = "Approves";
			}
			if (square.hasClass('yellow')) {
				ceo_approval = "No Opinion";
			}
			if (square.hasClass('red')) {
				ceo_approval = "Disapproves";		
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
		console.log(review);
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