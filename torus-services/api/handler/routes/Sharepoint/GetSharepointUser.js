 var reqExpress = require('express');
 var router = reqExpress.Router();
 //var str={};

 router.post('/GetSharepointUser', function(pReq, pResp, next) {
     try {
         if (global.USERNAME == undefined) {
             var f = "FAILURE"
             console.log(f);
             pResp.send("FAILURE");


         } else {
             console.log(global.USERNAME);
             delete global.USERNAME;
             var s = "SUCCESS"
             console.log(s);
             pResp.send("SUCCESS");
         }
     } catch (error) {
         errorHandler("ERR-FX-13324", "Error in SaveContent function " + error)
     }
 });
 module.exports = router;