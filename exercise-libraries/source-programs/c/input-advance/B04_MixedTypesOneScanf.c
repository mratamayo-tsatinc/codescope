/*
@codescope
@title Mixed Types in One scanf
@result total
@input target=quantity value=4 min=1 max=50 step=1
@input target=price value=19.5 min=1 max=500 step=0.5 decimals=2
@input target=size value='M' choices='S'|'M'|'L'
*/
#include <stdio.h>

int main() {
    int quantity;
    float price;
    char size;
    float total;

    printf("Enter quantity, unit price and size letter: ");
    scanf("%d %f %c", &quantity, &price, &size);
    total = quantity * price;
    printf("Size: %c\n", size);
    printf("Total: %.2f\n", total);
    return 0;
}
