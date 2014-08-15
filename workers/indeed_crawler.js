var request = require('request');
var cheerio = require('cheerio');
var Q = require('q');

var URL 							= "http://www.indeed.com/cmp/Google/reviews";
var PAGINATE_URL1 		= "?start="; //page index goes after = sign ex20
var PAGINATE_URL2 		= "&lang=en";
var REVIEWS_PER_PAGE 	= 20;

exports.crawlIndeedReview = function crawlIndeedReview(url, percentComplete) {
	var deferred = Q.defer();
	var promisesArray = [];
	var reviewsArray = [];
	var completedPromises = 0;
	getNumberOfIndeedReviews(url)
	.then(function(numReviews){
		numPages = Math.ceil(numReviews/REVIEWS_PER_PAGE)
		console.log(numReviews + " Indeed Reviews");
		console.log(numPages + " Indeed Pages");
		for (i=0; i<1; i++) {
			pageIndex = i * REVIEWS_PER_PAGE;
			searchURL = url + PAGINATE_URL1 + pageIndex + PAGINATE_URL2;
			featured = (i == 0)?(true):(false);
			promise = getReviewsFromIndeedURL(searchURL, featured);
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
			promisesArray.push(promise);
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

exports.getNumberOfIndeedReviews = getNumberOfIndeedReviews = function getNumberOfIndeedReviews(url) {
	var deferred = Q.defer();
	request(url, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var $ = cheerio.load(body);
			companyLabel = $('#company_avg_ratings_label').find('.count').text();
			deferred.resolve(parseFloat(companyLabel.replace(',', '')));
		} else {
			deferred.reject('Could not get reviews from Indeed');
		}
	})
	return deferred.promise;
}

exports.getReviewsFromIndeedURL = getReviewsFromIndeedURL = function getReviewsFromIndeedURL(url, getFeaturedReview) {
	// console.log('Fetching URL: ' + url);
	var deferred = Q.defer();
	request(url, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			deferred.resolve(parseBodyForIndeedReviews(body, getFeaturedReview));		
		} else {
			deferred.reject('Could not get reviews from Indeed');
		}
	});
	return deferred.promise;
}

function parseBodyForIndeedReviews (body, getFeaturedReview) {
	var $ = cheerio.load(body);
	var reviewsArray = [];
	$('.company_review_container').filter(function(){
		someData = $(this).children().eq(0);

		featuredReview = someData.parent().parent().attr('id');
		if (!getFeaturedReview && featuredReview == 'company_review_featured_container') {
				return;
		}

		review_title = someData.find('.review_title').text();
		review_date = someData.find('.dtreviewed').text();

		rating_data = someData.find('.company_ratings');
		company_rating = parseInt(rating_data.find('.value-title').attr('title'), 10);
		extended_rating = rating_data.find('.ratings_expanded').children();

		job_work_life_balance = starValueFromElement(extended_rating.eq(0));
		compensation_benefits = starValueFromElement(extended_rating.eq(1));
		job_security 					= starValueFromElement(extended_rating.eq(2));
		management 						= starValueFromElement(extended_rating.eq(3));
		job_culture 					= starValueFromElement(extended_rating.eq(4));
		
		review_pros = '';
		review_pros_data = someData.find('.review_pros');
		if (review_pros_data.length >= 1) {
			review_pros = review_pros_data.text().replace('Pros: ', '');
		}

		review_cons = '';
		review_cons_data = someData.find('.review_cons');
		if (review_cons_data.length >= 1) {
			review_cons = review_cons_data.text().replace('Cons: ', '');
		}

		review_description = '';
		review_description_data = someData.find('.description');
		if (review_description_data.length >= 1) {
			review_description = review_description_data.text();
			review_description = review_description.replace(' – more...', '');
			review_description = review_description.replace(' – less', '');
		}

		review = {
			'title':review_title,
			'date':review_date,
			'content_pros':review_pros,
			'content_cons':review_cons,
			'content_description':review_description,
			'rating_company': company_rating,
			'rating_job_work_life_balance':job_work_life_balance,
			'rating_job_security':job_security,
			'rating_job_culture':job_culture,
			'rating_management':management,
			'rating_compensation_benefits':compensation_benefits
		}
		reviewsArray.push(review);
	});
	return reviewsArray;
}

function indeedRatingToStarRating(indeedRating) {
	switch (indeedRating) {
		case '86.0':
			return 5;
		case '68.8':
			return 4;
		case '51.6':
			return 3;
		case '34.4':
			return 2;
		case '17.2':
			return 1;
		case '0.0':
			return 0;
		default:
			return 0;
	}
}

function starValueFromElement(element) {
	return indeedRatingToStarRating(element.find('.rtg_o').children().css().width.replace('px', ''));
}
