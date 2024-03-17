 /*
  @Decsription: Mail object and properties  
*/

 function MailMessage()
 {
    var From ='';   
    var PortNo= '' ;
    var ConfigCode= '' ;
    var Pwd ='';
    var Server= '' ;
    var ServerName= '' ;
    var PlainText= '' ;
    var To= '' ;
    var Cc= '' ;
    var Bcc= '' ;
    var Subject= '' ;
    var Body= '' ;
    //var Attachments() As SortedDictionary(Of String, Byte())
    var IsBodyHtml='';
    var ReplyTo= '' ;
    var EMailID ='';
    var MailId ='';   
    var InProgress ='';
    var Config ='';
    var  DateTime='';
    var address=new Address();
    address.Name = 'ram';
    address.Email = 'ram@ram.ram'; 
    var FromAddress = address;
}

function Address()
{
     var Name ='';
     var Email='';
}

module.exports = {
    Address: Address,
    MailMessage: MailMessage 
};
/********* End of File *************/