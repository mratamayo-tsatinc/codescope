/*
 * @codescope
 * @title Personal Information Display
 * @bug id=bug-1 line=1 token=1 correct="#" wrong="&" choices="&|%"
 * @bug id=bug-2 line=3 token=1 correct="int" wrong="INT" choices="INT|integer"
 * @bug id=bug-3 line=7 token=1 correct="printf" wrong="print" choices="print|Printf"
 * @bug id=bug-4 line=8 token=1 correct="printf" wrong="print" choices="print|Printf"
 * @bug id=bug-5 line=9 token=5 correct=";" wrong="," choices=",|:"
 */
#include <stdio.h>

int main()
{
    char initial = 'J';
    int age = 21;
    printf("Initial: %c\n", initial);
    printf("Age: %d\n", age);
    printf("Status: Active\n");
    return 0;
}
