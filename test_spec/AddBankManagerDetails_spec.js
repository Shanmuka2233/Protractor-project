var BasePage = require('..//pages//BasePage.js');
var AddBankManagerDetails = require('..//pages//AddBankManagerDetails.js');
var obj =require('../Object2.json');

describe("BankManager login test", function(){


    it("bankmanager login page", function(){

           BasePage.navigateToURL("https://www.way2automation.com/angularjs-protractor/banking/#/login");
           
           AddBankManagerDetails.gotoBankmanagerpage();
    });
    it("Add custome page", function(){
         AddBankManagerDetails.gotoaddcustomer();
         AddBankManagerDetails.addcustomerinfo(obj.locators.Bankmanagerpage.testdata.fname,obj.locators.Bankmanagerpage.testdata.lname,obj.locators.Bankmanagerpage.testdata.pcode);
 });


 it("Add openaccount page", function(){

    AddBankManagerDetails.gotoopenaccount();
});
it("Add customer page", function(){

    AddBankManagerDetails.gotocustomer();
    AddBankManagerDetails.verifycustomerdetails();
});
});