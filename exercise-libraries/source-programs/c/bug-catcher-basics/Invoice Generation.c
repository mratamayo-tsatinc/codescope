/*
 * @codescope
 * @title Invoice Generation
 * @bug id=bug-1 line=5 token=1 correct="char" wrong="Char" choices="Char|String"
 * @bug id=bug-2 line=6 token=1 correct="int" wrong="Int" choices="Int|integer"
 * @bug id=bug-3 line=7 token=1 correct="float" wrong="Float" choices="Float|doublee"
 * @bug id=bug-4 line=8 token=1 correct="printf" wrong="Printf" choices="Printf|print"
 * @bug id=bug-5 line=8 token=9 correct="amount" wrong="Amount" choices="Amount|total"
 * @bug id=bug-6 line=9 token=1 correct="return" wrong="Return" choices="Return|retun"
 */
#include <stdio.h>

int main()
{
    char name[] = "John Doe";
    int id = 12345;
    float amount = 99.99;
    printf("Invoice for Customer: %s\nOrder ID: %d\nTotal Amount: $%.2f", name, id, amount);
    return 0;
}
