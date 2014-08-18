var kue = require('kue'),
		jobs = kue.createQueue();

kue.app.listen(3001);
jobs.promote(500);

//crawlType = "crawlURL"  && "crawlUrlLong"
//cb(error, completed, progress)
exports.crawlURL = crawlURL = function crawlURL (crawlType ,data, cb) {
	var job = jobs.create(crawlType, data);
	job.delay(1000);
	job.attempts(1);
	job
	.on('complete', function (){
		cb(null, true);
	})
	.on('failed', function (error){
		cb(error)
	})
	.on('progress', function (progress){
    cb(null, null, progress);
	})
	job.save();
}

//remove successfully completed jobs from redis
jobs.on('job complete', function(id){
  kue.Job.get(id, function(err, job){
		if (err) {
			return;
		}
		job.remove(function (err){
    	if (err) {
    		return;
    	}
      console.log('removed completed job #%d', job.id);
    });
  });
});