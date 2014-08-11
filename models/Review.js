var mongoose = require('mongoose'),
    Schema = mongoose.Schema

var ReviewSchema = new Schema({
		company_name:{type: String, required: true},
  	created_at: Date,
  	glassdoor_url: String,
  	indeed_url: String,
  	csv_file_path: { type: String, default: '' },
  	failed: {type: Boolean, default: false}
});

ReviewSchema.pre('save', function(next){
  	if ( !this.created_at ) {
			this.created_at = new Date;
 		}
  	next();
});

module.exports = mongoose.model('Review', ReviewSchema);