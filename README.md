# ESCPOS-Printing-in-Node.js

[![Join the chat at https://gitter.im/treh1966/ESCPOS-Printing-in-Node.js](https://badges.gitter.im/treh1966/ESCPOS-Printing-in-Node.js.svg)](https://gitter.im/treh1966/ESCPOS-Printing-in-Node.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
This is my implementation of ESCPOS Printing from within node nw.js applications   
This is a fully working demo project, the mere module is available at:  
https://www.npmjs.com/package/pure-escpos  

ADVANTAGE: nothing else needed i.e. no dependencies except built in modules:  
'fs' , 'os' ( in fact only needed when using on multiple platforms), and 'child process'

CEAVEAT: as its based on copying files to the printer-queue biderectional commands are not supported  
Tried to implement all basically necessary (and common betweeen printer models ) commands in an easy usable fashion
 
TODO: improve error tracking, implement more of the full command list, implement OSX

Prerequisites:  
On Windows as of Version 1.1.1 Powershell is now used instead ofcmd(netview) to detect Printers  
Hope this will help as no locale specific Keyword for printer is used(hardcoded).  
At least one RAW-printer needs to be installed on the system :  
Under WINDOWS : just use the printer driver to install, most modern printers support both modes (driver and RAW) automatically
and !!! share the printer using a NAME which will be listed when network shares are ealuated  
On LINUX (and OSX): just install a (driverless) RAW Printer it will be listed by lp

Usage:
 ```javascript
 // if installed via npm
 //Printer = require('escpos_printing.js');
 // or if simply in working directory
 Printer = require('./escpos_printing.js');
 Printer.ESCPOS_INIT();
 Printer.append(put commands and functions here);
 var sucess = Printer.ESCPOS_PRINT(currentPrinter);
    if(!sucess){
       alert(Printer.ESCPOS_LASTERROR);
    }           

```
Functions summary:  
ESCPOS_INIT : Initialize globals and lists printers to array  
append : adds commands and Text to the "Print Buffer"  
ESCPOS_CMD : submit a command (as defined in the set)  
ESCPOS_PRINT : collect "Printer Buffer" write it to a prt file and send the file to the printer-queue  
ESCPOS_IMAGEFILE : print image from a file  
ESCPOS_BARCODE : Print Barcodes  
ESCPOS_QRCODE : Print QR-Codes  
ESCPOS_CPBYNUMBER : Select a codepage ( Named Versions available as extra command sets)  
ESCPOS_CP_EPSON : Select codepage as defined by epson  
ESCPOS_CP_STAR : Select Codepage as defined by STAR using standard ESCPOS Command  
STAR_CP : Select codepage using a special command used by star printers  
ESCPOS_CHARSET : select international characterset

for more examples of usage look at main.js
