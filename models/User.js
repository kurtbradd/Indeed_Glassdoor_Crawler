var mongoose = require('mongoose'),
    Schema = mongoose.Schema

var UserSchema = new Schema({
  	email:{type: String, required: true},
    hash_password: {type: String, required: true},
  	created_at: Date,
  	updated_at: Date
});

UserSchema.pre('save', function(next){
  	this.updated_at = new Date;
  	if ( !this.created_at ) {
		this.created_at = new Date;
 	}
  	next();
});

module.exports = mongoose.model('User', UserSchema);