var module = angular.module('MyApp.controllers', []);

module.controller('DashboardCtrl', ['$scope', 'Review', function($scope, Review){
	console.log('cntl loaded');
	$scope.review = {
		company_name:'',
		indeed_url:'',
		glassdoor_url:''
	}

	// REMOVE IN PRODUCTION
	$scope.review.company_name = 'Google';
	$scope.review.glassdoor_url = 'http://www.glassdoor.ca/Reviews/Google-Reviews-E9079.htm';
	$scope.review.indeed_url = 'http://www.indeed.com/cmp/Google/reviews';

	$scope.searchText = '';
	$scope.reviews = [];
	$scope.crawlProgress = 0;

	//in production use actual host name
	var socket = io.connect('http://localhost');
	socket.on('crawlProgress', function (progress) {
		$scope.crawlProgress = progress;
		$scope.$apply();
		console.log(progress);
	});

	socket.on('crawlComplete', function (data) {
		console.log('complete');
		$scope.crawlProgress = 0;
		$scope.getReviews();
		window.alert('Completed');
	});

	socket.on('crawlFailed', function (data) {
		console.log('failed...');
		window.alert(data);
		$scope.crawlProgress = 0;
		$scope.$apply();
	});

	$scope.percentComplete = function () {
		return "width: " + $scope.crawlProgress + "%;";
	};


	$scope.getReviews = function () {
		Review.getReviews()
		.success(function(data){
			$scope.reviews = data.reverse();
			console.log($scope.reviews);
		})
		.error(function(error){
			console.log(error);
		});
	}

	$scope.dateToString = function (date) {
		date = new Date(date);
		return date.toDateString() + " @ " +date.toLocaleTimeString()
	}

	$scope.getReviews();

	$scope.submitLong = function () {
		console.log('starting long web crawl');
		Review.submitLong($scope.review)
		.success(function(data){
			console.log(data)
		})
		.error(function(error) {
			console.log('could not start long crawl');
			window.alert('Error: Please make sure all fields are filled & correct');
		});
	}

	$scope.submit = function () {
		console.log('starting web crawl');
		Review.submit($scope.review)
		.success(function(data) {
			console.log(data);
		})
		.error(function(data){
			console.log('could not start web crawl');
			window.alert('Error: Please make sure all fields are filled & correct');
		});
	}
  
}])