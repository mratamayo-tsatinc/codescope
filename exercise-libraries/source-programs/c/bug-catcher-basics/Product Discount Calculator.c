/*
 * @codescope
 * @title Product Discount Calculator
 * @bug id=bug-1 line=1 token=1 correct="#" wrong="&" choices="&|%"
 * @bug id=bug-2 line=3 token=3 correct="(" wrong=";" choices=";|:"
 * @bug id=bug-3 line=4 token=1 correct="{" wrong="}" choices="}|)"
 * @bug id=bug-4 line=5 token=1 correct="double" wrong="Double" choices="Double|floaty"
 * @bug id=bug-5 line=7 token=6 correct="price" wrong="Price" choices="Price|cost"
 * @bug id=bug-6 line=8 token=3 correct="price" wrong="Price" choices="Price|cost"
 * @bug id=bug-7 line=9 token=3 correct="price" wrong="Price" choices="Price|cost"
 * @bug id=bug-8 line=11 token=2 correct="0" wrong="\"0\"" choices="\"0\"|O"
 */
#include <stdio.h>

int main()
{
    double price, discount, total;
    printf("Price: ");
    scanf("%lf", &price);
    discount = price * 0.10;
    total = price - discount;
    printf("Final Price: %.2lf", total);
    return 0;
}
