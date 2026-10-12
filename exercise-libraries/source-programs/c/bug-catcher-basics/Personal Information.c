/*
 * @codescope
 * @title Personal Information
 * @bug id=bug-1 line=1 token=2 correct="include" wrong="includ" choices="includ|Include"
 * @bug id=bug-2 line=1 token=4 correct="stdio" wrong="studio" choices="studio|stdioo"
 * @bug id=bug-3 line=5 token=1 correct="char" wrong="Char" choices="Char|string"
 * @bug id=bug-4 line=6 token=1 correct="int" wrong="Int" choices="Int|integer"
 * @bug id=bug-5 line=11 token=6 correct="age" wrong="Age" choices="Age|ages"
 * @bug id=bug-6 line=13 token=1 correct="scanf" wrong="Scanf" choices="Scanf|scan"
 * @bug id=bug-7 line=14 token=1 correct="printf" wrong="print" choices="print|Printf"
 * @bug id=bug-8 line=14 token=11 correct=";" wrong=":" choices=":|,"
 */
#include <stdio.h>

int main()
{
    char name[50];
    int age;
    char city[50];
    printf("Enter your name: ");
    scanf("%s", name);
    printf("Enter your age: ");
    scanf("%d", &age);
    printf("Enter your city: ");
    scanf("%s", city);
    printf("Name: %s \nAge: %d \nCity: %s\n", name, age, city);
    return 0;
}
