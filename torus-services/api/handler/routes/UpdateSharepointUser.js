 var reqExpress = require('express');
 var router = reqExpress.Router();
 //var str={};

 router.post('/UpdateSharepointUser', function(pReq, pResp, next) {

   global.USERNAME = 'wilson';
   pResp.send('SUCCESS');

 });
 module.exports = router;