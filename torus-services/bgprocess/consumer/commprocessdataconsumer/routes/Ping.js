/*******
   @Description - Ping api for testing service is alive or not 
   @Released	- Path changes
 *******/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();

router.get('/Ping', function(pReq, pRes) {
    try {
        pRes.send('SUCCESS');
    } catch (error) {
        console.log(error);
    }
});

module.exports = router;
/******** End of Service **********/