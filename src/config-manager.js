let config = {}
if(process.env.CONFIG) {
	config = JSON.parse(process.env.CONFIG)
}else {
	config = require('./../config')
}
module.exports = config