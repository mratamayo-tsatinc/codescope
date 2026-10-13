/*
@codescope
@title Mobile Wallet Transfer
@seed openingBalance min=500 max=900 step=50
@seed transfer min=120 max=280 step=20
@seed charge min=10 max=30 step=5
*/
#include <stdio.h>

int main(void)
{
    int openingBalance = 700;
    int transfer = 200;
    int charge = 20;
    int deduction;
    int remainingBalance;

    deduction = transfer + charge;
    remainingBalance = openingBalance - deduction;

    printf("WALLET TRANSFER\n");
    printf("Sent: P%d\n", transfer);
    printf("Service charge: P%d\n", charge);
    printf("Remaining balance: P%d\n", remainingBalance);

    return 0;
}

