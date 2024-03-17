var reqExpress = require('express');
var downloadAttachment = require('./helper/ExchangeHelper');
var path = require('path');
var fs = require('fs');
var router = reqExpress.Router();

router.get('/DownloadAttachment', function (pReq, pRes) {
    try {

        var fileName = pReq.query.fileName;

        var tempPath = path.resolve("./temp/" + fileName);

        if (fs.existsSync(path.resolve("./temp/"))) {
            pRes.download(tempPath, '', function (err) {
                if (!err) {
                    console.log("DOWNLOADED" + new Date());
                }
            });
        }
        else{
            pRes.end();
 
        }


    } catch (error) {
        pRes.end();
        
    }
});

module.exports = router;