/*
@codescope
@title Values of different types
@seed age min=18 max=35
@seed height min=150.0 max=190.0 decimals=1
@seed grade values='A'|'B'|'C'
@seed name values="Maria"|"Diego"|"Amina"
*/
public class TaskJuliet {
    public static void main(String[] args) {
        int age = 20;
        double height = 165.5;
        char grade = 'A';
        String name = "Maria";

        System.out.println("Name: " + name);
        System.out.println("Age: " + age);
        System.out.println("Height: " + height + " cm");
        System.out.println("Grade: " + grade);
        System.out.println("Pi (2 decimals): " + 3.14);
        System.out.println("Pi (4 decimals): " + 3.1416);
    }
}
