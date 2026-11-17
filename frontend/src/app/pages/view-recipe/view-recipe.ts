import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Apiservice } from '../../services/apiservice';
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
@Component({
  selector: 'app-view-recipe',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './view-recipe.html',
  styleUrl: './view-recipe.css',
})
export class ViewRecipe implements OnInit {

  recipeId: any = "";
  recipe: any = {};
  relatedRecipes: any[] = [];
  
  constructor(
    private ar: ActivatedRoute,
    private api: Apiservice
  ) { }

  ngOnInit(): void {

    this.ar.params.subscribe((res: any) => {
      this.recipeId = res.id;
      this.viewARecipe();
    });

  }

  viewARecipe() {
    this.api.viewRecipeAPI(this.recipeId).subscribe({
      next: (res: any) => {
        console.log(res);
        this.recipe = res;

        // After recipe loads, fetch related
        if (this.recipe?.cuisine) {
          this.getRelatedRecipe(this.recipe.cuisine);
        }
      },
      error: (err: any) => {
        console.log("API error: " + err);
      }
    });
  }

  getRelatedRecipe(cuisine: string) {

    this.api.getRelatedRecipeAPI(cuisine).subscribe({
      next: (res: any) => {
        console.log("Related:", res);
        this.relatedRecipes = res;
      },
      error: (err: any) => {
        console.log("API error: " + err);
      }
    });

  }

  addDownload() {
    this.api.addDownloadAPI(this.recipeId, this.recipe).subscribe({
      next: (res: any) => {
        console.log(res);
        alert(res.message)
      },
      error: (err: any) => {
        console.log("API error: " + err);
      }
    })
  }

generatePDF(){
    //create pdf object
    const pdf = new jsPDF()
    //For styling
    pdf.setFontSize(16)
    pdf.setTextColor("red")
    pdf.text(this.recipe.name,10,10)
    pdf.setFontSize(12)
    pdf.setTextColor("black")
    //pdf contents
    pdf.text(`Cuisine : ${this.recipe.cuisine}`,10,20)
    pdf.text(`Servings : ${this.recipe.servings}`,10,25)
    pdf.text(`Mode of Cooking : ${this.recipe.difficulty}`,10,30)
    pdf.text(`Total Preparation Time : ${this.recipe.prepTimeMinutes} Minutes`,10,35)
    pdf.text(`Total Cooking Time : ${this.recipe.cookTimeMinutes} Minutes`,10,40)
    pdf.text(`Total Calorie Per Servings : ${this.recipe.caloriesPerServing}`,10,45)
    //Table creation
    let head = [['Ingredients Needed','Cooking Instructions']]
    let body = []

    body.push([this.recipe.ingredients,this.recipe.instructions])
    //table generation
    autoTable(pdf,{head,body,startY:50})

    pdf.output('dataurlnewwindow')
    pdf.save('download-recipe.pdf')
        }

   addRecipeDownload(){
    this.api.addDownloadAPI(this.recipeId,this.recipe).subscribe({
        next: (res:any) => {
        console.log(res);
      },
      error:(err) => {
        console.log(err);
        
      }
    })
   } 
}
