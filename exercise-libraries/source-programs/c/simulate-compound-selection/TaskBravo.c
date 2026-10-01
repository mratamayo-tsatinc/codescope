/*
@codescope
@title Bank Account
@seed balance min=1100 max=1500 step=100
@seed deposit min=250 max=350 step=50
@seed withdrawal min=100 max=500 step=100
@seed serviceFee min=15 max=30 step=5
*/
#include <stdio.h>

int main(void)
{
    int balance = 1200, deposit = 350, withdrawal = 200, serviceFee = 25;
    int finalBalance, transactionOK;

    finalBalance = balance + deposit - withdrawal - serviceFee;
    transactionOK = (deposit > 0 && withdrawal <= balance) ||
                    (withdrawal == 0 && !((deposit < 0)));

    if (transactionOK && finalBalance >= 1000) {
        serviceFee = serviceFee - 10;
    } else if (!transactionOK || finalBalance < 500) {
        serviceFee = serviceFee + 20;
    } 
    
    finalBalance = balance + deposit - withdrawal - serviceFee;

    printf("balance = %d\n", balance);
    printf("deposit = %d\n", deposit);
    printf("withdrawal = %d\n", withdrawal);
    printf("serviceFee = %d\n", serviceFee);
    printf("finalBalance = %d\n", finalBalance);
    printf("transactionOK = %d\n", transactionOK);
    return 0;
}
