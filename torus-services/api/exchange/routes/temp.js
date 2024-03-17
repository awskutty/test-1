var reqExpress = require('express');
var router = reqExpress.Router();
var exchangeEngine = require('./helper/ExchangeEngine');

router.post('/temp', function (pReq, pRes) {
    try {
        pReq = pReq.body;
        var inputData = {
            "ruleObj":pReq.ruleObj,
            "selectedData":pReq.selectedData,
            "process":"EXPORT",
            "PATH": "E:\\petproj\\"
        }
        exchangeEngine.ExchangeEngine(inputData,function(response){
            pRes.send(response);
        })
        
    } catch (error) {
        pRes.send(error);
    }
});

module.exports = router;