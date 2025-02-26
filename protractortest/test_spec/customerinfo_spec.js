var BasePage = require('..//pages//BasePage.js');
var customerinfo = require('..//pages//customerinfo.js');
var obj =require('../Object.json');

describe("Customer login test",function(){
  
    it("login as customerpage",function(){

        BasePage.navigateToURL("https://www.way2automation.com/angularjs-protractor/banking/#/login");
         BasePage.getPageTitle();
        customerinfo.customerlogin();
        browser.sleep(2000);
        customerinfo.gotocustomer();
        browser.sleep(2000);
        customerinfo.verifytitle();
        browser.sleep(2000);
        customerinfo.selectnumber();
        browser.sleep(1000);
        customerinfo.verifytext();
  
        browser.sleep(2000);
    
    });
    var customerinfo = require('..//pages//customerinfo.js');
  it("go to withdrawl page", function(){
    browser.sleep(2000);
    customerinfo.gotowithdrawl();
    
    browser.sleep(1000);
    customerinfo.enteramount();
    
    browser.sleep(1000);
    customerinfo.clickwithdrawl();
    customerinfo.resultmessage();


    customerinfo.gotodeposit();
    browser.sleep(1000);
    customerinfo.enteramount0();
    customerinfo.clickwithdrawl0();
    browser.sleep(1000);
    customerinfo.resultmessage0();
    browser.sleep(1000);

  });
 
  
 var customerinfo = require('..//pages//customerinfo.js');
  it("goto customertransaction page", function(){
    browser.sleep(1000);
    customerinfo.gototransactions();
    browser.sleep(1000);
    customerinfo.verifymessage1();
    browser.sleep(1000);
  });

});