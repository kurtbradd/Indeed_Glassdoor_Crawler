var dependencies = ['ngRoute',
										'ui.bootstrap',
										'underscore',
										'MyApp.controllers',
										'MyApp.factories']

var app = angular.module('MyApp', dependencies)

app.config(['$routeProvider', '$locationProvider',
	function($routeProvider, $locationProvider) {
		$routeProvider
			.when('/dashboard', {
				templateUrl:'./views/dashboard-view.html',
				controller:'DashboardCtrl'
			})
			.otherwise({
				redirectTo:'/dashboard'
			});
		$locationProvider.html5Mode(true);
}]);

var underscore = angular.module('underscore', []);
	underscore.factory('_', function() {
		return window._; // assumes underscore has already been loaded on the page
});