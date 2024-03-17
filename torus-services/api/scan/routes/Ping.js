var reqExpress = require('express');
var router = reqExpress.Router();

router.get('/Ping', function (pReq, pRes) {
    try {
        pRes.send('SUCCESS');
    } catch (error) {
        console.log(error);
    }
});

module.exports = router;