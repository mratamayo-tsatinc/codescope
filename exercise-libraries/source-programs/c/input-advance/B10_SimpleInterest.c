/*
@codescope
@title Simple Interest
@result totalAmount
@input target=principal value=10000 min=1000 max=100000
@input target=rate value=5 min=1 max=20
@input target=years value=3 min=1 max=30
*/
#include <stdio.h>

#define PERCENT 100

int main() {
    int principal;
    int rate;
    int years;
    int interest;
    float totalAmount;

    printf("Enter the principal amount: ");
    scanf("%d", &principal);
    printf("Enter the yearly rate (percent) and number of years: ");
    scanf("%d %d", &rate, &years);
    interest = principal * rate * years / PERCENT;
    totalAmount = principal + interest;
    printf("Interest: %.2f\n", interest);
    printf("Total amount: %.2f\n", totalAmount);
    return 0;
}
