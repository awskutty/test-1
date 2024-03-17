// Require dependenices
var reqExpress = require('express');
var router = reqExpress.Router();
var reqSocketHelper = require('./helper/SocketHelper')

// Router api
router.post('/EmitMessage', function (appRequest, appResponse) {
    reqSocketHelper.EmitMessage(appRequest, appResponse)
});

module.exports = router;

/******* End of service *********/