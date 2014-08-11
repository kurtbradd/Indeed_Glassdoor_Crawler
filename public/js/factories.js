var module = angular.module('MyApp.factories', []);

module.factory('Review', ['$http', function($http){
	return {
		submit: function (data) {
			return $http({
				method:'POST',
				url:'/api/reviews',
				data:data
			});
		},
		getReviews: function () {
			return $http({
				method:'GET',
				url:'/api/reviews'
			})
		}
	}
}])